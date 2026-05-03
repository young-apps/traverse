import SwiftUI

/// Placeholder root view shown after login.
/// Replace this with your actual tab/navigation structure.
struct ContentView: View {
    @EnvironmentObject private var auth: AuthenticationManager

    var body: some View {
        NavigationStack {
            Text("Welcome, \(auth.currentUser?.displayName ?? auth.currentUser?.email ?? "traveller")!")
                .navigationTitle("Traverse")
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Sign out") { auth.signOut() }
                    }
                }
        }
    }
}
