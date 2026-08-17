"use strict";

const Auth = {

    tokenKey:
        window.PLINKO_ADMIN_CONFIG.TOKEN_KEY,

    getToken() {
        return localStorage.getItem(this.tokenKey);
    },

    setToken(token) {

        if (!token) {
            throw new Error("Invalid authentication token");
        }

        localStorage.setItem(
            this.tokenKey,
            token
        );
    },

    clear() {
        localStorage.removeItem(this.tokenKey);
    },

    isAuthenticated() {
        return Boolean(this.getToken());
    },

    logout() {
        this.clear();
        window.location.reload();
    }
};

window.Auth = Auth;

window.addEventListener(
    "admin:unauthorized",
    () => {
        Auth.clear();
    }
);
