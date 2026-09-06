"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  updateProfile,
  updatePassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/appShell";
import PageHeader from "@/components/navigation/pageHeader";
import {
  EMAIL_PREF_OPTIONS,
  getNotificationPrefs,
  NotificationPrefs,
  NotificationType,
  updateNotificationPrefs,
  uploadAvatar,
} from "@/lib/helper";
import { Bell, CircleUser, Pen } from "lucide-react";

interface DashboardPageProps {
  userName: string;
}

export default function AccountPage({ userName }: DashboardPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const [editingField, setEditingField] = useState<"name" | "photo" | null>(
    null
  );
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || "");
        setPhotoURL(currentUser.photoURL || "");
        setPhotoPreview(currentUser.photoURL || "");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    async function loadPrefs() {
      if (!user) return;
      setPrefsLoading(true);
      const data = await getNotificationPrefs(user.uid);
      setPrefs(data);
      setPrefsLoading(false);
    }
    loadPrefs();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      let nextPhoto = photoURL.trim();
      if (editingField === "photo" && photoFile) {
        try {
          const uploaded = await uploadAvatar(user.uid, photoFile);
          nextPhoto = uploaded.url;
        } catch (error: any) {
          setStatusMessage(
            error?.message ||
              "Error uploading photo. Use a JPG, PNG, GIF, or WebP under 5MB."
          );
          return;
        }
      }
      if (editingField === "photo" && nextPhoto) {
        try {
          const parsed = new URL(nextPhoto);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            setStatusMessage("Photo URL must start with http:// or https://");
            return;
          }
        } catch {
          setStatusMessage("Enter a valid photo URL or choose an image file.");
          return;
        }
      }

      await updateProfile(user, {
        displayName,
        ...(editingField === "photo" ? { photoURL: nextPhoto || null } : {}),
      });
      await user.reload();
      const nextUser = auth.currentUser;
      if (nextUser) {
        setUser(nextUser);
        setDisplayName(nextUser.displayName || "");
        setPhotoURL(nextUser.photoURL || nextPhoto);
        setPhotoPreview(nextUser.photoURL || nextPhoto);
      }
      setPhotoFile(null);
      setEditingField(null);
      setStatusMessage("Profile updated successfully");
    } catch (error: any) {
      setStatusMessage("Error updating profile: " + error.message);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword) return;

    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);

      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setStatusMessage("Password updated successfully ✅");
    } catch (error: any) {
      setStatusMessage("Error updating password: " + error.message);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const savePrefs = async (next: NotificationPrefs) => {
    if (!user) return;
    setPrefs(next);
    setPrefsSaving(true);
    const saved = await updateNotificationPrefs(user.uid, next);
    setPrefsSaving(false);
    if (saved) {
      setPrefs(saved);
      setStatusMessage("Notification preferences saved");
    } else {
      setStatusMessage("Error saving notification preferences");
    }
  };

  const handleEmailEnabled = (emailEnabled: boolean) => {
    if (!prefs) return;
    savePrefs({ ...prefs, emailEnabled });
  };

  const handleEmailType = (key: NotificationType, enabled: boolean) => {
    if (!prefs) return;
    savePrefs({
      ...prefs,
      email: { ...prefs.email, [key]: enabled },
    });
  };

  if (!user) return null;

  return (
    <AppShell onSignOut={handleSignOut} userName={userName} user={user}>
      <PageHeader
        title="Account Settings"
        icon={<CircleUser className="w-6 h-6" />}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-10">
          <section className="bg-background-alt rounded-xl shadow-md p-6 space-y-6">
            <h2 className="text-xl font-semibold">Profile</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Display Name</p>
                {editingField === "name" ? (
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="p-2 mt-1 rounded-md border border-border 
                    bg-background text-foreground text-sm focus:ring-2 
                    focus:ring-primary focus:outline-none"
                  />
                ) : (
                  <p className="font-medium">{displayName || "Unnamed"}</p>
                )}
              </div>
              {editingField === "name" ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    className="px-3 py-1 rounded-md bg-foreground text-background text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingField(null)}
                    className="px-3 py-1 rounded-md border text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingField("name")}
                  className="p-2 hover:bg-border-hover rounded-lg"
                >
                  <Pen className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img
                  src={photoPreview || photoURL || "/default-avatar.png"}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full border border-border object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-400">Photo</p>
                  {editingField === "photo" ? (
                    <div className="mt-1 space-y-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setPhotoFile(file);
                          if (file) {
                            setPhotoPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="block w-full text-sm text-gray-300 file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1 file:text-sm file:text-background"
                      />
                      <input
                        type="url"
                        value={photoFile ? "" : photoURL}
                        onChange={(e) => {
                          setPhotoFile(null);
                          setPhotoURL(e.target.value);
                          setPhotoPreview(e.target.value);
                        }}
                        placeholder="Or paste an image URL"
                        className="w-full p-2 rounded-md border border-border 
                        bg-background text-foreground text-sm focus:ring-2 
                        focus:ring-primary focus:outline-none"
                      />
                    </div>
                  ) : (
                    <p className="font-medium truncate">
                      {photoURL || "Not set"}
                    </p>
                  )}
                </div>
              </div>
              {editingField === "photo" ? (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleSaveProfile}
                    className="px-3 py-1 rounded-md bg-foreground text-background text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingField(null);
                      setPhotoFile(null);
                      setPhotoURL(user.photoURL || "");
                      setPhotoPreview(user.photoURL || "");
                    }}
                    className="px-3 py-1 rounded-md border text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingField("photo")}
                  className="p-2 hover:bg-border-hover rounded-lg shrink-0"
                >
                  <Pen className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-400">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Account Created</p>
              <p className="font-medium">
                {new Date(user.metadata.creationTime).toLocaleDateString()}
              </p>
            </div>
          </section>

          <section className="bg-background-alt rounded-xl shadow-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-semibold">Notifications</h2>
            </div>
            <p className="text-sm text-gray-400">
              In-app notifications are always on. These settings only control email.
            </p>
            {prefsLoading ? (
              <p className="text-sm text-gray-400">Loading preferences...</p>
            ) : !prefs ? (
              <p className="text-sm text-gray-400">
                Could not load notification preferences.
              </p>
            ) : (
              <>
                <label className="flex items-center justify-between gap-4">
                  <span className="font-medium">Email notifications</span>
                  <input
                    type="checkbox"
                    checked={prefs.emailEnabled}
                    disabled={prefsSaving}
                    onChange={(e) => handleEmailEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
                <ul
                  className={`space-y-3 pt-2 ${
                    prefs.emailEnabled ? "" : "opacity-50"
                  }`}
                >
                  {EMAIL_PREF_OPTIONS.map((option) => (
                    <li key={option.key}>
                      <label className="flex items-center justify-between gap-4">
                        <span className="text-sm">{option.label}</span>
                        <input
                          type="checkbox"
                          checked={prefs.email[option.key] !== false}
                          disabled={prefsSaving || !prefs.emailEnabled}
                          onChange={(e) =>
                            handleEmailType(option.key, e.target.checked)
                          }
                          className="h-4 w-4"
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="bg-background-alt rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Security</h2>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="rounded-lg bg-foreground text-background px-4 py-2 font-medium hover:bg-border-hover"
            >
              Change Password
            </button>
          </section>
        </div>

        {statusMessage && (
          <p className="text-sm text-blue-500 px-4 sm:px-6 lg:px-8 pb-6">
            {statusMessage}
          </p>
        )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-alt rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Change Password</h2>
            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full mb-3 p-2 rounded-md border border-border 
                bg-background text-foreground text-sm focus:ring-2 
                focus:ring-primary focus:outline-none"
            />
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full mb-4 p-2 rounded-md border border-border 
                bg-background text-foreground text-sm focus:ring-2 
                focus:ring-primary focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-3 py-1 rounded-md border text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                className="px-3 py-1 rounded-md bg-foreground text-background text-sm"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
