"use client";

import { useState, useCallback } from "react";

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "default";
  resolve: ((ok: boolean) => void) | null;
}

interface PromptState {
  open: boolean;
  title: string;
  defaultValue: string;
  placeholder: string;
  confirmLabel: string;
  resolve: ((value: string | null) => void) | null;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    variant: "default",
    resolve: null,
  });

  const confirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      variant?: "danger" | "default";
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel || "Confirm",
          variant: opts.variant || "default",
          resolve,
        });
      });
    },
    []
  );

  const onConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const onCancel = useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  return { state, confirm, onConfirm, onCancel };
}

export function usePromptDialog() {
  const [state, setState] = useState<PromptState>({
    open: false,
    title: "",
    defaultValue: "",
    placeholder: "",
    confirmLabel: "OK",
    resolve: null,
  });

  const prompt = useCallback(
    (opts: {
      title: string;
      defaultValue?: string;
      placeholder?: string;
      confirmLabel?: string;
    }): Promise<string | null> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          title: opts.title,
          defaultValue: opts.defaultValue || "",
          placeholder: opts.placeholder || "",
          confirmLabel: opts.confirmLabel || "OK",
          resolve,
        });
      });
    },
    []
  );

  const onConfirm = useCallback(
    (value: string) => {
      state.resolve?.(value);
      setState((s) => ({ ...s, open: false, resolve: null }));
    },
    [state.resolve]
  );

  const onCancel = useCallback(() => {
    state.resolve?.(null);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  return { state, prompt, onConfirm, onCancel };
}
