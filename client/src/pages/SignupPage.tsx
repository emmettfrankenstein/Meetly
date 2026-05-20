import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../services/authApi";
import { useAuthStore } from "../stores/authStore";

export function SignupPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setError("");
      setIsSubmitting(true);

      const result = await signup({
        username,
        email,
        password,
      });

      setUser(result.user);
      navigate("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            Meetly
          </p>

          <h1 className="mt-3 text-3xl font-bold">Create account</h1>
          <p className="mt-2 text-slate-400">
            Your meetings deserve a name and a login.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-300">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
                required
                minLength={3}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
                required
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
                required
                minLength={8}
              />
            </label>

            {error && (
              <p className="rounded-xl border border-rose-800 bg-rose-950 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            )}

            <button
              disabled={isSubmitting}
              className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isSubmitting ? "Creating account..." : "Sign up"}
            </button>
          </form>

          <p className="mt-5 text-sm text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-cyan-300">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
