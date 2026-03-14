import React, { useState } from 'react'
import authBg from '../assets/images/authBg.png'
import { IoEye } from "react-icons/io5";
import { IoEyeOff } from "react-icons/io5";
import { useNavigate } from 'react-router-dom';
import { UserDataContext } from '../ContextApi/Usercontext';
import axios from 'axios';

const Loginpage = () => {

    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { serverUrl , setUserData } = React.useContext(UserDataContext);

    const HandleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const result = await axios.post(`${serverUrl}/api/auth/login`, {
                email,
                password
            }, { withCredentials: true });

            setUserData(result.data.user);
            navigate("/customize");

        } catch (err) {
            console.log(err);
            setUserData(null);
            setError(err?.response?.data?.message || "Something went wrong. Please try again later.");
            return;
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className='scene-shell overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8'>
            <img className='pointer-events-none absolute inset-y-0 left-[-10%] hidden h-full max-w-none scale-x-[-1] opacity-20 mix-blend-screen lg:block' src={authBg} alt="" />

            <div className='relative z-10 mx-auto grid min-h-screen w-full max-w-7xl gap-6 lg:grid-cols-[0.96fr_1.04fr] lg:items-center'>
                <section className='cinema-panel cinema-panel-strong order-2 p-5 sm:p-7 lg:order-1 lg:p-8'>
                    <div className='mb-6 space-y-3'>
                        <p className='cinema-kicker'>Return to Control</p>
                        <h2 className='text-3xl font-semibold text-white sm:text-4xl'>
                            Sign in and reconnect with your assistant
                        </h2>
                        <p className='text-sm text-white/70 sm:text-base'>
                            Your saved assistant profile, wake phrase, and control room are waiting for you.
                        </p>
                    </div>

                    <form onSubmit={HandleLogin} className='flex w-full flex-col gap-4'>
                        <input
                            type="email"
                            placeholder='Enter your email'
                            required
                            autoComplete="email"
                            onChange={(e) => setEmail(e.target.value)}
                            value={email}
                            className='cinema-input'
                        />

                        <div className='relative'>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                required
                                autoComplete="current-password"
                                onChange={(e) => setPassword(e.target.value)}
                                value={password}
                                className="cinema-input pr-12"
                            />

                            {showPassword ? (
                                <IoEyeOff
                                    onClick={() => setShowPassword(false)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-cyan-100/70"
                                    size={20}
                                />
                            ) : (
                                <IoEye
                                    onClick={() => setShowPassword(true)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-cyan-100/70"
                                    size={20}
                                />
                            )}
                        </div>

                        <button
                            disabled={loading}
                            className='holo-button mt-2 flex min-h-12 w-full items-center justify-center text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:text-base'
                        >
                            {loading ? <span className='btn-loader' aria-label='Loading' /> : "Enter Mission Control"}
                        </button>
                    </form>

                    {error.length > 0 && (
                        <p className='mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200'>
                            {error}
                        </p>
                    )}

                    <div className='mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between'>
                        <p className='text-sm text-white/78 sm:text-base'>
                            Need a new account?
                        </p>
                        <button onClick={() => navigate("/signup")} className='text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200 transition hover:text-cyan-100 sm:text-[0.8rem]'>
                            Start the onboarding
                        </button>
                    </div>
                </section>

                <section className='order-1 space-y-6 py-4 lg:order-2'>
                    <p className='cinema-kicker'>Cerate AI // Mission Control</p>
                    <h1 className='cinema-heading max-w-4xl'>
                        Step back into a <span className='text-cyan-300'>cinematic control room</span> built around your assistant.
                    </h1>
                    <p className='cinema-copy'>
                        The interface is tuned to feel immersive and responsive everywhere, with cinematic lighting, layered glass panels, and voice-first interaction built into the experience.
                    </p>

                    <div className='grid gap-4 sm:grid-cols-3'>
                        <div className='cinema-panel cinema-panel-tilt p-5'>
                            <p className='cinema-kicker'>Wake Engine</p>
                            <p className='mt-3 text-xl font-semibold text-white'>Name-based activation</p>
                            <p className='mt-2 text-sm text-white/70'>Say the assistant name and it responds like a dedicated companion, not a generic chatbot.</p>
                        </div>
                        <div className='cinema-panel cinema-panel-tilt p-5'>
                            <p className='cinema-kicker'>Adaptive UI</p>
                            <p className='mt-3 text-xl font-semibold text-white'>Phone, tablet, desktop</p>
                            <p className='mt-2 text-sm text-white/70'>Layouts stay sharp and layered instead of collapsing into flat mobile stacks.</p>
                        </div>
                        <div className='cinema-panel cinema-panel-tilt p-5'>
                            <p className='cinema-kicker'>Presence</p>
                            <p className='mt-3 text-xl font-semibold text-white'>Movie-like atmosphere</p>
                            <p className='mt-2 text-sm text-white/70'>Soft glow, 3D surfaces, and command-deck styling give the assistant real character.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}

export default Loginpage
