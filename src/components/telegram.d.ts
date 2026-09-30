export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: { user?: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string } };
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (c: string) => void;
        HapticFeedback?: { impactOccurred: (s: "light" | "medium" | "heavy") => void; notificationOccurred: (s: "success" | "error" | "warning") => void };
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
