declare module '@firebase/auth/dist/rn' {
  export {
    getAuth,
    initializeAuth,
    getReactNativePersistence,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    User,
    UserCredential,
    Auth,
  } from '@firebase/auth';
}
