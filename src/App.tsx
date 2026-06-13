import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import type { AxisKey } from '@/types';
import { useDocumentStore } from '@/store/documentStore';
import DataPanel from '@/components/data/DataPanel';
import CanvasPanel from '@/components/canvas/CanvasPanel';
import EditorPanel from '@/components/editor/EditorPanel';
import ImportWizard from '@/components/import/ImportWizard';

/**
 * Application shell. Owns the three-panel layout and the single DnD context
 * that connects the column blocks (left) to the axis drop zones (center). All
 * domain state lives in the stores; this component only routes a completed drag
 * to the document store's `assignAxis` action.
 */
export default function App() {
  const assignAxis = useDocumentStore((s) => s.assignAxis);

  // A small activation distance lets clicks-inside-blocks still work as drags
  // without hijacking ordinary clicks elsewhere.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const columnId = event.active.data.current?.columnId as string | undefined;
    const axis = event.over?.data.current?.axis as AxisKey | undefined;
    if (columnId && axis) assignAxis(columnId, axis);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="app">
        <header className="app__header">
          <div className="app__brand">
            Chart Builder Pro
            <span>데이터를 올리고, 원하는 시각화를 골라, PPT로 내보내기</span>
          </div>
          <div className="app__header-spacer" />
        </header>

        <div className="app__body">
          <DataPanel />
          <main className="app__main">
            <CanvasPanel />
            <EditorPanel />
          </main>
        </div>
      </div>

      <ImportWizard />
    </DndContext>
  );
}
