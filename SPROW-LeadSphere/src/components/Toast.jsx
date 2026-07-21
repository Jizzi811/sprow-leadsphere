import { useEffect } from "react";
import { X, CheckCircle, WarningCircle } from "@phosphor-icons/react";

export function Toast({ message, type = "success", visible, onClose }) {
  useEffect(() => {
    if (!visible || !message) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [visible, message, onClose]);

  if (!visible || !message) return null;

  const Icon = type === "error" ? WarningCircle : CheckCircle;

  return (
    <div className={`toast toast-${type}`}>
      <Icon size={18} weight="fill" />
      <span>{message}</span>
      <button onClick={onClose} aria-label="Schliessen">
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  const { useState, useCallback } = require("react");
  const [state, setState] = useState({ message: "", type: "success", visible: false });

  const show = useCallback((msg, type = "success") => {
    setState({ message: msg, type, visible: true });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  return { toast: state, show, close };
}
