import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export function ConfirmToast() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [type, setType] = useState<"success" | "expired">("success");

  useEffect(() => {
    const { confirmed } = router.query;
    if (!confirmed) return;
    setType(confirmed === "1" ? "success" : "expired");
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 5000);
    router.replace("/", undefined, { shallow: true });
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.confirmed]);

  if (!visible) return null;

  const isSuccess = type === "success";

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-[420px] w-[calc(100%-32px)] flex items-start gap-[10px] py-3 px-4 rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.18)] border ${
      isSuccess ? "bg-[#4caf7d18] border-[#4caf7d40]" : "bg-[#f59e0b18] border-[#f59e0b40]"
    }`}>
      <span className={`text-[15px] shrink-0 mt-0.5 ${isSuccess ? "text-ak-green" : "text-[#d97706]"}`}>
        {isSuccess ? "✓" : "⚠"}
      </span>
      <span className={`text-[13px] font-bold flex-1 leading-[1.45] ${isSuccess ? "text-ak-green" : "text-[#d97706]"}`}>
        {isSuccess
          ? "Email confirmed -- welcome to the team!"
          : "This confirmation link has expired or was already used. Please subscribe again."}
      </span>
      <button
        onClick={() => setVisible(false)}
        className={`bg-transparent border-0 cursor-pointer text-base leading-none p-0 shrink-0 opacity-70 ${isSuccess ? "text-ak-green" : "text-[#d97706]"}`}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}
