# Traverse Native — Xcode Setup

## 1. Create the Xcode project

- Open Xcode → File → New → Project
- Choose **iOS → App**
- Product Name: `Traverse`
- Bundle ID: `com.youngapps.traverse`
- Interface: **SwiftUI**, Language: **Swift**
- Uncheck "Include Tests" for now
- Save somewhere you like (NOT inside the old Capacitor folder)

## 2. Add Firebase via Swift Package Manager

Xcode → File → Add Package Dependencies

| Package URL | Minimum version |
|---|---|
| `https://github.com/firebase/firebase-ios-sdk` | 11.0.0 |
| `https://github.com/google/GoogleSignIn-iOS` | 8.0.0 |

From `firebase-ios-sdk`, select only:
- **FirebaseAuth**
- **FirebaseFirestore** (if you use Firestore)
- **FirebaseStorage** (if you use Storage)

(Keep it lean — each SDK adds build time.)

## 3. Add GoogleService-Info.plist

- Download from Firebase console → Project settings → iOS app
- Drag into the Xcode project (check "Copy items if needed" + your target)
- Make sure it appears in **Build Phases → Copy Bundle Resources**

## 4. Enable capabilities

In Xcode, select the **Traverse** target → **Signing & Capabilities**:
- Click **+** → add **Sign in with Apple**
- Click **+** → add **Push Notifications** (if needed later)

## 5. Add the URL scheme for Google Sign-In

- Select the target → **Info** tab → **URL Types**
- Click **+**
- Role: Editor, URL Schemes: paste your `REVERSED_CLIENT_ID`
  (from GoogleService-Info.plist, looks like `com.googleusercontent.apps.XXXXXX`)

## 6. Copy the source files

Copy everything from the `native/` folder into your Xcode project:
```
TraverseApp.swift              → replaces the generated App file
Authentication/
  AuthenticationManager.swift
  LoginView.swift
  ContentView.swift
```

Delete the auto-generated `ContentView.swift` Xcode created, then add these.

## 7. Handle the Google Sign-In URL callback

In `TraverseApp.swift`, add the `onOpenURL` modifier so Google's OAuth
redirect returns to the app:

```swift
var body: some Scene {
    WindowGroup {
        ...
    }
    .onOpenURL { url in
        GIDSignIn.sharedInstance.handle(url)
    }
}
```

This is already in the provided TraverseApp.swift.

## 8. Apple Sign-In — why the nonce matters

Apple only returns the full `identityToken` **once** per authorization.
If you reuse a credential, Firebase rejects it with:

> `auth/missing-or-invalid-nonce: Duplicate credential received`

The fix (already in `AuthenticationManager.swift`):
1. `randomNonceString()` generates a fresh 32-byte nonce **before every attempt**
2. `sha256(nonce)` is sent to Apple in the request
3. The **raw** nonce is passed to `OAuthProvider.appleCredential(withIDToken:rawNonce:)`
4. Firebase re-hashes it and compares — they match, auth succeeds
5. `currentNonce` is cleared after use so it can't be replayed

## 9. Build & run

Cmd+R on a real device (Sign in with Apple requires a device or account-signed simulator).
