import Foundation
import Combine
import CryptoKit
import AuthenticationServices
import FirebaseAuth
import GoogleSignIn
import FirebaseCore

@MainActor
final class AuthenticationManager: NSObject, ObservableObject {

    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?

    var isAuthenticated: Bool { currentUser != nil }

    // Stored so it survives the Apple callback
    private var currentNonce: String?
    private var authStateHandle: AuthStateDidChangeListenerHandle?

    override init() {
        super.init()
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.currentUser = user
            }
        }
    }

    deinit {
        if let handle = authStateHandle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    // MARK: - Google Sign-In

    func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        guard let clientID = FirebaseApp.app()?.options.clientID else {
            errorMessage = "Firebase client ID not found."
            return
        }
        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config

        guard let windowScene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            errorMessage = "Could not find root view controller."
            return
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootVC)
            guard let idToken = result.user.idToken?.tokenString else {
                errorMessage = "Google sign-in returned no ID token."
                return
            }
            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: result.user.accessToken.tokenString
            )
            try await Auth.auth().signIn(with: credential)
        } catch {
            errorMessage = friendlyError(error)
        }
    }

    // MARK: - Apple Sign-In

    /// Call this from the button tap — kicks off the ASAuthorization flow.
    func startAppleSignIn() {
        let nonce = randomNonceString()
        currentNonce = nonce                          // keep the RAW nonce for Firebase

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)                 // send only the HASH to Apple

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func signOut() {
        do {
            GIDSignIn.sharedInstance.signOut()
            try Auth.auth().signOut()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func friendlyError(_ error: Error) -> String {
        let nsError = error as NSError
        switch nsError.code {
        case AuthErrorCode.cancelled.rawValue:        return ""   // user dismissed — no toast needed
        case AuthErrorCode.networkError.rawValue:     return "Network error. Check your connection."
        default:                                      return error.localizedDescription
        }
    }

    // MARK: - Nonce generation (Apple requirement)

    private func randomNonceString(length: Int = 32) -> String {
        var randomBytes = [UInt8](repeating: 0, count: length)
        guard SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes) == errSecSuccess else {
            fatalError("SecRandomCopyBytes failed")
        }
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String(randomBytes.map { charset[Int($0) % charset.count] })
    }

    private func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AuthenticationManager: ASAuthorizationControllerDelegate {

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let appleIDToken = appleIDCredential.identityToken,
              let idTokenString = String(data: appleIDToken, encoding: .utf8) else {
            Task { @MainActor in self.errorMessage = "Apple sign-in failed: missing identity token." }
            return
        }

        // currentNonce MUST match what was hashed and sent to Apple
        guard let nonce = Task { @MainActor in self.currentNonce }.value else {
            Task { @MainActor in self.errorMessage = "Apple sign-in failed: nonce missing." }
            return
        }

        let credential = OAuthProvider.appleCredential(
            withIDToken: idTokenString,
            rawNonce: nonce,          // raw nonce — Firebase re-hashes and compares with Apple's copy
            fullName: appleIDCredential.fullName
        )

        Task { @MainActor in
            self.isLoading = true
            defer { self.isLoading = false }
            do {
                try await Auth.auth().signIn(with: credential)
                self.currentNonce = nil   // consumed — clear it
            } catch {
                self.errorMessage = self.friendlyError(error)
            }
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        // ASAuthorizationError.canceled (code 1001) = user tapped Cancel — not a real error
        let asError = error as? ASAuthorizationError
        if asError?.code != .canceled {
            Task { @MainActor in self.errorMessage = error.localizedDescription }
        }
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AuthenticationManager: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }?
            .windows.first { $0.isKeyWindow } ?? UIWindow()
    }
}
