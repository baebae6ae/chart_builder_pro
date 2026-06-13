import { useDraggable } from '@dnd-kit/core';
import type { ColumnMeta } from '@/types';

const TYPE_LABEL: Record<ColumnMeta['type'], string> = {
  number: '숫자',
  date: '날짜',
  string: '텍스트',
};

const TYPE_COLOR: Record<ColumnMeta['type'], string> = {
  number: '#2563eb',
  date: '#10b981',
  string: '#9ca3af',
};

/**
 * A draggable "lego block" for one dataset column. Dragging carries the column
 * id; the axis drop zones read it on drop. Numeric/date typing is surfaced so
 * users know which blocks make sense on a value axis.
 */
export default function ColumnBlock({ column }: { column: ColumnMeta }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: column.id,
    data: { columnId: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`block${isDragging ? ' block--dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <span className="block__dot" style={{ background: TYPE_COLOR[column.type] }} />
      <span className="block__name">{column.name}</span>
      <span className="block__type">{TYPE_LABEL[column.type]}</span>
    </div>
  );
}
