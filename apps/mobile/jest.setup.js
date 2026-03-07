// Jest setup for Mooviz Mobile
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    currentUser: null,
    sendPasswordResetEmail: jest.fn(),
    verifyPhoneNumber: jest.fn(),
  }),
  PhoneAuthProvider: { credential: jest.fn() },
}));

jest.mock('@react-native-firebase/firestore', () => {
  const mockCollection = jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ exists: false, data: () => null })),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
    })),
  }));
  return {
    __esModule: true,
    default: () => ({ collection: mockCollection }),
    FieldValue: { serverTimestamp: jest.fn(() => 'mock-timestamp') },
  };
});

jest.mock('@react-native-firebase/storage', () => ({
  __esModule: true,
  default: () => ({
    ref: jest.fn(() => ({
      putFile: jest.fn(() => ({
        on: jest.fn(),
        then: jest.fn((cb) => cb()),
      })),
      getDownloadURL: jest.fn(() => Promise.resolve('https://mock-url.com/photo.jpg')),
      delete: jest.fn(() => Promise.resolve()),
    })),
  }),
}));

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
