import { ReactNode } from 'react';

interface TreeRowProps {
  indent?: number;
  checked: boolean;
  onCheck: () => void;
  onClick?: () => void;
  left: ReactNode;
  name: string;
  meta?: string;
  nameBold?: boolean;
}

export default function TreeRow({
  indent = 0,
  checked,
  onCheck,
  onClick,
  left,
  name,
  meta,
  nameBold = false,
}: TreeRowProps) {
  return (
    <div className="flex items-center mb-2" style={{ paddingLeft: indent }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => {
          e.stopPropagation();
          onCheck();
        }}
        className="mr-2 form-checkbox"
      />
      <div
        className="flex items-center justify-between w-full cursor-pointer select-none"
        onClick={onClick}
      >
        <div className="flex items-center">
          {left}
          <span className={(nameBold ? 'font-medium ' : '') + 'text-neutral-800 dark:text-neutral-200'}>
            {name}
          </span>
        </div>
        {meta ? (
          <span className="text-xs text-neutral-400 mr-2">{meta}</span>
        ) : null}
      </div>
    </div>
  );
}
