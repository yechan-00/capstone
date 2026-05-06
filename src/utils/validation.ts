export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 6) {
    return { valid: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' };
  }
  return { valid: true };
};

export const validateAmount = (amount: number): { valid: boolean; message?: string } => {
  if (amount <= 0) {
    return { valid: false, message: '금액은 0보다 커야 합니다.' };
  }
  if (amount > 100000000) {
    return { valid: false, message: '금액이 너무 큽니다.' };
  }
  return { valid: true };
};

export const validateRequired = (value: string | undefined | null): { valid: boolean; message?: string } => {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: '필수 입력 항목입니다.' };
  }
  return { valid: true };
};
