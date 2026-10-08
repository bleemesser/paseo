import type { Theme } from "@/styles/theme";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentScreenReadySyncState } from "@/hooks/use-agent-screen-state-machine";
import { useTranslation } from "react-i18next";
import { withUnistyles } from "react-native-unistyles";
import { ToastViewport, type ToastState } from "@/components/toast-host";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getHostRuntimeStore } from "@/runtime/host-runtime";

const spinnerColor = (theme: Theme) => ({ color: theme.colors.foreground });
const ThemedLoadingSpinner = withUnistyles(LoadingSpinner);
const keepUntilSynchronized = () => {};

function useReconnectCountdownSeconds(serverId: string, active: boolean): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!active) {
      setSeconds(null);
      return;
    }
    const tick = () => {
      const nextAt = getHostRuntimeStore().getNextReconnectAt(serverId);
      setSeconds(nextAt === null ? null : Math.max(1, Math.ceil((nextAt - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [serverId, active]);
  return seconds;
}

export function TimelineSyncStatus({
  serverId,
  sync,
  toast,
  onDismiss,
}: {
  serverId: string;
  sync: AgentScreenReadySyncState | null;
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  let state: "reconnecting" | "updating" | null = null;
  if (sync?.status === "reconnecting") state = "reconnecting";
  else if (sync?.status === "catching_up" && sync.ui === "status") state = "updating";
  const isReconnecting = state === "reconnecting";
  const seconds = useReconnectCountdownSeconds(serverId, isReconnecting);
  let label: string | null = null;
  if (isReconnecting && seconds !== null) {
    label = t("agentPanel.states.reconnectingIn", { seconds });
  } else if (state) {
    label = t(`agentPanel.states.${state}`);
  }
  const retryLabel = t("agentPanel.states.retry");
  const retry = useCallback(() => getHostRuntimeStore().reconnectNow(serverId), [serverId]);
  const syncToast = useMemo<ToastState | null>(
    () =>
      state && label
        ? {
            id: isReconnecting ? 1 : 2,
            content: label,
            nativeMessage: label,
            icon: <ThemedLoadingSpinner size={18} uniProps={spinnerColor} />,
            variant: "default",
            durationMs: null,
            testID: `agent-${state}-toast`,
            ...(isReconnecting ? { action: { label: retryLabel, onPress: retry } } : {}),
          }
        : null,
    [state, label, isReconnecting, retryLabel, retry],
  );
  return (
    <ToastViewport
      toast={toast ?? syncToast}
      onDismiss={toast ? onDismiss : keepUntilSynchronized}
      placement="panel"
    />
  );
}
