import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @EnvironmentObject private var auth: AuthenticationManager

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo
                Circle()
                    .fill(Color.white)
                    .frame(width: 14, height: 14)
                    .padding(.bottom, 24)

                Text("Traverse")
                    .font(.system(size: 32, weight: .semibold, design: .default))
                    .foregroundColor(.white)
                    .padding(.bottom, 8)

                Text("Your hotel passport")
                    .font(.title3)
                    .foregroundColor(.white)
                    .padding(.bottom, 4)

                Text("Track every stay · Build your story · See where friends are going")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .padding(.bottom, 48)

                // Apple Sign-In  ← native ASAuthorizationButton
                SignInWithAppleButton(.continue) { request in
                    request.requestedScopes = [.fullName, .email]
                    // The button calls startAppleSignIn() which generates a fresh nonce
                } onCompletion: { _ in
                    // Handled by ASAuthorizationControllerDelegate in AuthenticationManager
                }
                .signInWithAppleButtonStyle(.white)
                .frame(height: 50)
                .padding(.horizontal, 32)
                .padding(.bottom, 16)
                .simultaneousGesture(TapGesture().onEnded {
                    auth.startAppleSignIn()
                })

                // Google Sign-In
                Button {
                    Task { await auth.signInWithGoogle() }
                } label: {
                    HStack(spacing: 10) {
                        GoogleLogoShape()
                            .frame(width: 18, height: 18)
                        Text(auth.isLoading ? "Signing in…" : "Continue with Google")
                            .fontWeight(.medium)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.white)
                    .foregroundColor(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .padding(.horizontal, 32)
                .disabled(auth.isLoading)

                if let msg = auth.errorMessage, !msg.isEmpty {
                    Text(msg)
                        .font(.footnote)
                        .foregroundColor(.red.opacity(0.9))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .padding(.top, 12)
                }

                Spacer()

                // Legal
                (Text("By continuing you agree to our ")
                    .foregroundColor(.white.opacity(0.5))
                 + Text("Privacy Policy")
                    .underline()
                    .foregroundColor(.white.opacity(0.7)))
                    .font(.caption)
                    .padding(.bottom, 32)
            }

            if auth.isLoading {
                Color.black.opacity(0.35).ignoresSafeArea()
                ProgressView()
                    .tint(.white)
                    .scaleEffect(1.4)
            }
        }
    }
}

// MARK: - Google "G" logo drawn as a Shape so no image asset needed

private struct GoogleLogoShape: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            // Blue
            var p = Path(); p.addArc(center: .init(x: w/2, y: h/2), radius: w/2, startAngle: .degrees(-20), endAngle: .degrees(90), clockwise: false)
            p.addLine(to: .init(x: w/2, y: h/2)); p.closeSubpath()
            ctx.fill(p, with: .color(.init(red: 0.26, green: 0.52, blue: 0.96)))
            // Green
            var p2 = Path(); p2.addArc(center: .init(x: w/2, y: h/2), radius: w/2, startAngle: .degrees(90), endAngle: .degrees(210), clockwise: false)
            p2.addLine(to: .init(x: w/2, y: h/2)); p2.closeSubpath()
            ctx.fill(p2, with: .color(.init(red: 0.2, green: 0.66, blue: 0.33)))
            // Yellow
            var p3 = Path(); p3.addArc(center: .init(x: w/2, y: h/2), radius: w/2, startAngle: .degrees(210), endAngle: .degrees(340), clockwise: false)
            p3.addLine(to: .init(x: w/2, y: h/2)); p3.closeSubpath()
            ctx.fill(p3, with: .color(.init(red: 0.98, green: 0.74, blue: 0.02)))
            // Red
            var p4 = Path(); p4.addArc(center: .init(x: w/2, y: h/2), radius: w/2, startAngle: .degrees(340), endAngle: .degrees(360-20), clockwise: false)
            p4.addLine(to: .init(x: w/2, y: h/2)); p4.closeSubpath()
            ctx.fill(p4, with: .color(.init(red: 0.92, green: 0.26, blue: 0.21)))
            // White center + horizontal bar
            ctx.fill(Path(ellipseIn: .init(x: w*0.28, y: h*0.28, width: w*0.44, height: h*0.44)), with: .color(.white))
            ctx.fill(Path(.init(x: w/2, y: h*0.38, width: w*0.46, height: h*0.24)), with: .color(.white))
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthenticationManager())
}
