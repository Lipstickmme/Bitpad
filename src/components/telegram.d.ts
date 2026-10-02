export {};

type Insets = { top: number; bottom: number; left: number; right: number };

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: { user?: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string } };
        platform?: string;
        isVersionAtLeast?: (v: string) => boolean;
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (c: string) => void;
        setBackgroundColor?: (c: string) => void;
        setBottomBarColor?: (c: string) => void;
        disableVerticalSwipes?: () => void;
        enableClosingConfirmation?: () => void;
        safeAreaInset?: Insets;
        contentSafeAreaInset?: Insets;
        onEvent?: (event: string, cb: () => void) => void;
        offEvent?: (event: string, cb: () => void) => void;
        BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
        HapticFeedback?: { impactOccurred: (s: "light" | "medium" | "heavy") => void; notificationOccurred: (s: "success" | "error" | "warning") => void; selectionChanged?: () => void };
        openLink?: (url: string) => void;
      };
    };
    onTelegramAuth?: (user: Record<string, string | number>) => void;
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
    ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean };
  }
  interface SolanaProvider {
    isPhantom?: boolean;
    connect: () => Promise<{ publicKey: { toString(): string } }>;
    disconnect: () => Promise<void>;
    signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string }>;
  }
}
