# Chart Builder Pro — 개발 매뉴얼 (Architecture Manual)

> 이 파일은 Claude Code가 세션 시작 시 **자동으로 읽어들이는** 프로젝트 규칙서입니다.
> 모든 코드 수정은 아래 규칙을 따릅니다. 새 코드를 짜기 전에 "이 코드가 어느 계층에
> 속하는가?"를 먼저 판단하고, 정해진 위치에만 둡니다. 규칙을 어겨야 할 상황이 생기면
> **코드를 끼워 맞추지 말고 먼저 사용자에게 알립니다.**

---

## 0. 한 줄 요약

엑셀 → 드래그앤드롭 시각화 → 수정 가능한 PPT 추출. **100% 브라우저 연산**(서버 비용 0),
Cloudflare Pages / GitHub Pages 정적 배포.

---

## 1. 황금 규칙 — 단방향 의존성 (이것만은 절대 어기지 않는다)

```
types/      ← 도메인 모델. 아무것도 import 하지 않는다.
  ▲
lib/        ← 순수 로직. types/ 와 다른 lib/ 만 import. React·store·DOM-store 금지.
  ▲
store/      ← 상태(Zustand). types/ 와 lib/ 만 import. 컴포넌트 import 금지.
  ▲
components/ ← UI. 무엇이든 import 가능하지만, 로직은 lib/ 에, 상태는 store/ 에 위임.
```

**의존성은 위에서 아래로만 흐른다.** 아래 계층이 위 계층을 import 하면 안 된다.
- `lib/` 안에서 `import ... from '@/store/...'` → **금지**
- `store/` 안에서 `import ... from '@/components/...'` → **금지**
- `types/` 안에서 그 무엇이든 import → **금지** (React 타입 포함)

예외: `store/importStore.ts` 는 다른 store(`documentStore`)를 호출한다. store 간 호출은
허용되지만, "오케스트레이션"용으로만 쓰고 순환(서로 import)은 만들지 않는다.

---

## 2. 디렉터리 지도 — 각 폴더의 책임

| 경로 | 책임 | 넣는 것 / 넣지 않는 것 |
| --- | --- | --- |
| `src/types/` | 도메인 모델(단일 진실 공급원) | ✅ 타입/인터페이스만. ❌ 함수·React |
| `src/lib/util/` | 범용 순수 헬퍼 | `id`, 타입추론(`infer`) 등. ❌ 도메인 특화 로직 |
| `src/lib/excel/` | 엑셀 입력 (파싱·구조화) | SheetJS 사용은 **여기서만** |
| `src/lib/chart/` | 차트 옵션 생성 규칙 | ECharts 옵션 빌드는 **여기서만** |
| `src/lib/theme/` | 테마(색상·폰트) 추출 | canvas/JSZip 추출은 **여기서만** |
| `src/lib/export/` | PPTX 생성 | pptxgenjs 사용은 **여기서만** |
| `src/store/` | 앱 상태 + 액션 | 도메인별 store 1개. 상태 변경은 **여기서만** |
| `src/components/data/` | 좌측 패널 UI (업로드·테마·컬럼블록) | |
| `src/components/canvas/` | 중앙 패널 UI (축 드롭존·차트·내보내기) | |
| `src/components/editor/` | 하단 패널 UI (그리드·스냅샷·비교) | |
| `src/components/import/` | 가져오기 마법사 모달 | |
| `src/components/common/` | 패널 간 공유 UI (예: `ChartView`) | |
| `functions/` | (선택) Cloudflare Pages Functions 백엔드 seam | 핵심 흐름엔 불필요 |

---

## 3. "이걸 추가하고 싶다" → 어디에 둘까 (결정 가이드)

| 하고 싶은 것 | 두는 곳 | 패턴 |
| --- | --- | --- |
| 새 시각화 종류(예: 버블·히트맵·트리맵) | `lib/chart/registry.ts` 에 항목 1개 추가 → `render` 가 `echarts` 면 `buildOption.ts` 에 `case` 추가, `table`/`kpi` 류면 `lib/chart/<x>Model.ts`(순수) + `components/common/<X>View.tsx`(표시) | 레지스트리가 단일 카탈로그. `VizRenderer` 가 자동 분기 |
| 새 차트 시리즈 표현(예: 점선) | `lib/chart/buildOption.ts` + `types`(`SeriesType`) | 옵션 생성 규칙만 수정, UI는 select 옵션 추가 |
| 새 데이터 입력 형식(예: JSON) | `lib/excel/`(또는 `lib/import/`)에 파서 추가 | `SheetMatrix` 또는 `DataTable` 형태로 반환 |
| 새 테마 추출 소스 | `lib/theme/extractColors.ts` 에 `extractFromX` 추가 + `extractTheme` 디스패치 | 동일한 `Theme` 반환 |
| 새 내보내기 형식(예: PNG, XLSX) | `lib/export/` 에 새 모듈 | 화면과 같은 `buildOption`/데이터 재사용 |
| 새 편집 동작(예: 열 삭제) | `store/documentStore.ts` 액션 추가 → 컴포넌트는 호출만 | 불변 업데이트 |
| 새 전역 상태 | 새 `store/xStore.ts` (단, 기존 store와 책임이 겹치면 합칠 것) | |
| 새 UI 위젯 | 해당 패널 폴더의 컴포넌트 | 로직은 lib, 상태는 store에 위임 |

**원칙: 새 기능은 "새 파일 추가"로 끝나야 한다. 기존 여러 파일을 헤집어야 한다면
계층 설계가 틀린 것이니 멈추고 재검토한다.**

---

## 4. 계층별 작성 패턴 (복붙용 기준)

### lib/ — 순수 함수
- 부수효과 없음(동적 import는 허용: 무거운 라이브러리 지연 로딩용).
- 입력 → 출력이 명확. React/store/`window` 전역 상태에 의존하지 않음.
- 무거운 라이브러리(`xlsx`, `pptxgenjs`, `echarts`, `jszip`)는 **반드시 함수 내부에서
  `await import(...)`** 로 지연 로딩한다 (초기 번들 비대화 방지).

### store/ — Zustand
```ts
interface XState {
  value: T;                      // 상태
  doSomething: (arg) => void;    // 액션
}
export const useXStore = create<XState>((set) => ({ ... }));
```
- 상태 변경은 **불변 업데이트**(`map`/스프레드)로. 기존 객체를 직접 mutate 금지
  (스냅샷이 깨진다).
- 셀렉터로 잘게 구독: 컴포넌트는 `useXStore((s) => s.value)` 형태로 필요한 조각만.

### components/ — React
- 가능한 한 "표시 + 이벤트 → store 액션 호출"만 한다.
- 데이터 가공/계산 로직을 컴포넌트 안에 쓰지 않는다 → `lib/` 로 옮긴다.
- 스타일은 `src/index.css` 의 클래스 사용(인라인 최소화). 새 클래스는 의미 있는
  BEM 유사 네이밍(`panel--data`, `chart-card__head`).

---

## 5. 하지 말 것 (스파게티 방지 체크리스트)

- ❌ 같은 로직을 두 곳에 복제하지 않는다. (예: 차트 데이터 추출은 `buildOption`의
  `categories`/`seriesData` 를 **재사용** — PPTX 내보내기도 이걸 쓴다.)
- ❌ 무거운 라이브러리를 파일 상단에서 정적 import 하지 않는다(타입 전용 `import type` 은 OK).
- ❌ 컴포넌트에서 store 상태를 직접 수정하지 않는다(반드시 액션 경유).
- ❌ `lib/`·`store/` 에서 DOM/React에 의존하지 않는다(`ChartView` 같은 렌더 경계만 예외).
- ❌ 거대한 "만능 유틸" 파일을 만들지 않는다. 책임별로 폴더를 나눈다.
- ❌ `any` 남발 금지. 외부 타입 한계는 좁은 범위에서 캐스팅하고 이유를 주석으로 남긴다
  (예: `lib/export/pptx.ts` 의 `AddCombo` 캐스팅).
- ❌ **UI에 기술 자랑·개발 메모를 노출하지 않는다.** 화면은 *최종 사용자(데이터를 시각화해
  PPT로 쓰려는 실무자)* 관점으로만 만든다. "서버 비용 0", "100% 브라우저 처리" 같은 내부
  구현 자랑, TODO, 디버그 문구는 화면 밖(README·주석)에 둔다. 화면의 안내 문구는 "이걸 어떻게
  쓰는가"에 직접 도움이 되는 것만 간결하게 남긴다.

---

## 6. 검증 (수정 후 항상)

```bash
npm run build      # tsc 타입체크 + vite 빌드. 통과해야 커밋.
npm run dev        # 로컬에서 실제 동작 확인.
```
- 타입체크가 곧 1차 안전망이다. `strict` + `noUnused*` 가 켜져 있으니 빌드 경고/에러 0 유지.
- 동작이 바뀌는 변경은 `npm run dev` 로 실제 시나리오(업로드→드래그→편집→내보내기)를 한 번 확인.

---

## 7. 배포 (참고)

- **GitHub Pages**: `.github/workflows/deploy.yml` 가 이 브랜치 push 시 빌드→배포.
  서브경로 배포라 빌드 시 `BASE_PATH=/chart_builder_pro/` 가 주입된다(워크플로가 설정).
- **Cloudflare Pages**: `wrangler.toml`. 빌드 `npm run build`, 출력 `dist`, base 는 `/`.
- 둘 다 정적 호스팅이며 **서버 연산이 없다**. 백엔드가 필요해지면 `functions/` 에만 추가하고
  클라이언트 구조는 건드리지 않는다.

---

## 8. 커밋

- 한 커밋 = 한 가지 논리적 변경. 메시지는 "무엇을/왜" 중심.
- 빌드가 통과하지 않으면 커밋하지 않는다.
