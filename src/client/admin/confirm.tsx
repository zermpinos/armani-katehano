import { Btn } from "./primitives";

export function Confirm({ msg, onConfirm, onCancel }: { msg: any; onConfirm: any; onCancel: any }) {
  if (!msg) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
      <div className="bg-ak-surface p-8 rounded-xl max-w-[400px] w-[90%] border border-ak-border2">
        <p className="mb-6 text-ak-text text-[14px]">{msg}</p>
        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
        </div>
      </div>
    </div>
  );
}
