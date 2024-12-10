declare interface ImportMeta {
    env: {
        SSR: boolean;
        PROD: boolean;
        DEV: boolean;
        MODE: "development" | "production"
    }
}
