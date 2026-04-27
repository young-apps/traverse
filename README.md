# Traverse

Track every hotel stay, see where your friends are traveling, and build your personal travel history.

## Setup (15 minutes)

### 1. Install

```bash
cd traverse
npm install
```

### 2. Firebase project (free tier)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. **Build → Authentication → Get started** → enable **Google** provider
3. **Build → Firestore Database → Create database** → production mode

### 3. Firestore rules

Paste in **Firestore → Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Stays — owner can read/write, friends can read
      match /stays/{stayId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        allow read: if request.auth != null && 
          exists(/databases/$(database)/documents/users/$(request.auth.uid)/friends/$(userId));
      }
      // Friends list — only owner
      match /friends/{friendId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        // Allow the friend to write (for mutual add on accept)
        allow write: if request.auth != null && (request.auth.uid == userId || request.auth.uid == friendId);
      }
      // Friend requests — anyone signed in can write (to send), owner can read/delete
      match /friendRequests/{requestId} {
        allow read, delete: if request.auth != null && request.auth.uid == userId;
        allow create: if request.auth != null;
      }
      // Profile — owner writes, any signed-in user reads
      match /profile/{docId} {
        allow write: if request.auth != null && request.auth.uid == userId;
        allow read: if request.auth != null;
      }
    }
    // Collection group query for profile lookup by email
    match /{path=**}/profile/{docId} {
      allow read: if request.auth != null;
    }
  }
}
```

### 4. Get API keys

- **Firebase config**: Project Settings → Your apps → Web → copy config
- **Mapbox**: [account.mapbox.com](https://account.mapbox.com) → copy public token
- **Google Places**: [console.cloud.google.com](https://console.cloud.google.com) → enable Places API → create restricted key

### 5. Configure

```bash
cp .env.example .env
# Fill in your keys in .env
```

### 6. Run

```bash
npm run dev
```

## Features

- 🔐 Google Sign-In
- 💾 Firestore persistence (per-user)
- 🗺️ Mapbox dark map with hotel pins
- 🔍 Google Places hotel search (worldwide)
- 📅 Date range calendar picker
- 🛏 Room types (Standard → Presidential Suite → Upgrade)
- 🔖 Booking source tracking (Direct, Amex FHR, Bonvoy, etc.)
- 🔢 Confirmation number
- 🏷 Loyalty / membership number
- 👥 Friends — add by email, see their stays
- 📊 Insights — brand affinity, nights by year/country, booking source breakdown
- ⚡ Optimistic saves (instant UI, Firestore syncs in background)
