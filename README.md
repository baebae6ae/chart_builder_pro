# Chart Builder Pro

엑셀 데이터를 **드래그 앤 드롭**으로 시각화하고, **수정 가능한 네이티브 PPT**로 즉시 추출하는
실무용 데이터 시각화 스튜디오입니다. Cloudflare Pages 배포를 전제로 설계되었습니다.

---

## 핵심 기능

| # | 기능 | 구현 위치 |
| --- | --- | --- |
| ① | **스마트 파싱 + 실시간 편집기** — 헤더 행/영역을 직접 지정, 셀 수정 시 차트 즉시 재렌더링 | `lib/excel`, `components/import`, `components/editor/DataGrid` |
| ② | **컬럼 블록 드래그 앤 드롭** — X / Y(좌) / Y(우) 축에 던지면 막대+꺾은선 혼합 차트 자동 구성 | `components/data/ColumnBlock`, `components/canvas/AxisZone` |
| ③ | **사내 테마(CI) 동기화** — 로고 이미지 또는 PPT 템플릿에서 색상·폰트 추출 후 전역 적용 | `lib/theme/extractColors`, `store/themeStore` |
| ④ | **시나리오 스냅샷 & A/B 분할 비교** — 현재 상태를 저장하고 두 시나리오를 나란히 비교 | `store/snapshotStore`, `components/editor/CompareBoard` |
| ⑤ | **네이티브 PPTX 추출** — 이미지가 아닌 수정 가능한 PowerPoint 차트 객체로 다운로드 | `lib/export/pptx` |

---

## 아키텍처 결정 (비용 · 성능 · 유지보수)

### 1. 서버 비용 0 — "엣지 정적 호스팅 + 100% 클라이언트 연산"

이 애플리케이션의 모든 무거운 연산(엑셀 파싱, 차트 렌더링, 색상 추출, PPTX 생성)은
**브라우저 안에서** 수행됩니다. 따라서 Cloudflare Pages의 정적 자산 호스팅만으로 동작하며,
서버(Worker) 연산 비용이 사실상 발생하지 않습니다.

- 사용자가 업로드한 데이터가 서버로 전송되지 않아 **개인정보·보안 측면에서도 유리**합니다.
- 트래픽이 늘어도 비용은 정적 자산 전송(=Cloudflare 무료/저비용 구간)만 증가합니다.

`functions/` 디렉터리는 **백엔드 확장 지점(seam)** 으로 남겨 두었습니다. 향후 공유 링크
(KV 저장), LLM 기반 인사이트 같은 *진짜* 서버 기능이 필요할 때만 이곳에 추가하면 되고,
클라이언트 구조는 건드리지 않습니다. (`functions/api/health.ts` 참고)

### 2. 지연·메모리 방지 — 온디맨드 코드 스플리팅

초기 진입 시 받는 번들은 약 **68 KB(gzip)** 뿐입니다. 용량이 큰 라이브러리는 실제로 쓰는
순간에만 동적 임포트됩니다.

| 라이브러리 | 로드 시점 |
| --- | --- |
| `xlsx` (SheetJS) | 파일을 **업로드**할 때 |
| `echarts` | **첫 차트**가 그려질 때 |
| `pptxgenjs` | **PPT 다운로드**를 누를 때 |
| `jszip` | **PPT 템플릿** 테마를 추출할 때 |

미리보기는 대용량 시트에서도 멈추지 않도록 화면에 보이는 범위(최대 50행×30열)만 렌더링합니다.

### 3. 스파게티 방지 — 단방향 계층 구조

각 계층은 한 방향으로만 의존하며, 책임이 명확히 분리되어 있습니다.

```
types/        도메인 모델 (단일 진실 공급원, 의존성 없음)
  ▲
lib/          순수 로직 (React·상태 무관, 테스트 용이)
  │  excel · chart · theme · export · util
  ▲
store/        상태 관리 (Zustand, 도메인별 1개씩)
  │  document · theme · snapshot · import
  ▲
components/   UI (패널별로만 분리)
     data(좌) · canvas(중앙) · editor(하단) · import · common
```

- **로직과 UI가 섞이지 않습니다.** 예: 차트 규칙은 `lib/chart/buildOption.ts` 한 곳에만 있고,
  화면 차트와 PPT 추출이 *같은 함수*를 공유하므로 "보이는 것 = 받는 것"이 보장됩니다.
- **상태는 store에서만 변경**됩니다. 컴포넌트는 셀렉터로 읽고 액션을 호출할 뿐, 상태를 직접
  바꾸지 않아 데이터 흐름이 항상 단방향입니다.
- 기능이 중복되거나 충돌하지 않도록, 비슷한 분류는 한 모듈로 모았습니다.

---

## 기술 스택

- **React 18 + TypeScript** — 타입 안전한 컴포넌트 UI
- **Vite** — 빠른 빌드 / 코드 스플리팅
- **Zustand** — 가볍고 보일러플레이트 없는 상태 관리
- **@dnd-kit/core** — 접근성 있는 드래그 앤 드롭
- **ECharts** — 혼합·이중축 차트 렌더링
- **SheetJS(xlsx)** — 엑셀/CSV 파싱
- **PptxGenJS** — 네이티브(수정 가능) PPTX 생성
- **Cloudflare Pages** — 엣지 정적 호스팅 (+ 선택적 Pages Functions)

---

## 개발 / 빌드 / 배포

```bash
npm install        # 의존성 설치
npm run dev        # 로컬 개발 서버 (http://localhost:5173)
npm run build      # 타입체크 + 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 미리보기

# Cloudflare Pages 배포
npm run deploy     # wrangler pages deploy dist
# 또는 Cloudflare 대시보드에서 빌드 명령 `npm run build`, 출력 디렉터리 `dist` 로 연결
```

### 빠른 체험

1. `npm run dev` 실행 후 좌측 **"엑셀 / CSV 업로드"** 에서 `public/sample-data.csv` 선택
2. 가져오기 창에서 헤더 행/영역 확인 후 **확인**
3. 좌측 컬럼 블록(`매출`, `영업이익` 등)을 중앙 **Y축** 영역으로 드래그 → 차트 생성
4. 하단 편집기에서 값 수정 → 차트 실시간 반영
5. **PPT 다운로드** 로 수정 가능한 .pptx 추출
