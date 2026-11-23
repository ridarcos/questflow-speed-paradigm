/** Validación de credenciales y traducción de errores de Firebase Auth (funciones puras). */

export const PASSWORD_MIN_LENGTH = 6;

// Formato razonable: algo@algo.tld sin espacios. Firebase hace la validación definitiva.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export interface CredentialErrors {
  email?: string;
  password?: string;
}

export function validateCredentials(email: string, password: string): CredentialErrors {
  const errors: CredentialErrors = {};
  if (email.trim().length === 0) {
    errors.email = "Introduce tu email.";
  } else if (!isValidEmail(email)) {
    errors.email = "Introduce un email con formato válido (nombre@dominio.com).";
  }
  if (password.length === 0) {
    errors.password = "Introduce tu contraseña.";
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return errors;
}

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/invalid-login-credentials": "Email o contraseña incorrectos.",
  "auth/wrong-password": "Email o contraseña incorrectos.",
  "auth/user-not-found": "Email o contraseña incorrectos.",
  "auth/invalid-email": "El email no tiene un formato válido.",
  "auth/missing-email": "Introduce tu email.",
  "auth/missing-password": "Introduce tu contraseña.",
  "auth/email-already-in-use": "Ya existe una cuenta con este email. Inicia sesión.",
  "auth/weak-password": "La contraseña es demasiado débil: usa al menos 6 caracteres.",
  "auth/user-disabled": "Esta cuenta está deshabilitada.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  "auth/network-request-failed": "No hay conexión con el servidor. Revisa tu red.",
  "auth/popup-closed-by-user": "Has cerrado la ventana de Google antes de terminar.",
  "auth/cancelled-popup-request": "Se canceló la ventana de Google. Inténtalo de nuevo.",
  "auth/popup-blocked": "El navegador bloqueó la ventana de Google.",
  "auth/unauthorized-domain":
    "Este dominio no está autorizado para iniciar sesión. Añádelo en Firebase Authentication.",
  "auth/operation-not-allowed": "Este método de acceso no está habilitado en Firebase.",
  "auth/account-exists-with-different-credential":
    "Ya existe una cuenta con este email usando otro método de acceso.",
  "auth/internal-error": "Error interno de autenticación. Inténtalo de nuevo.",
};

export const GENERIC_AUTH_ERROR = "No se pudo completar la operación. Inténtalo de nuevo.";

/** Extrae el código de un FirebaseError (o de cualquier objeto con `code`). */
export function authErrorCode(error: unknown): string | null {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

export function translateAuthError(error: unknown): string {
  const code = authErrorCode(error);
  return (code && AUTH_ERROR_MESSAGES[code]) || GENERIC_AUTH_ERROR;
}
