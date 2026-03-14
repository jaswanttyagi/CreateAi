import React, { useState } from 'react'
import authBg from '../assets/images/authBg.png'
import { IoEye } from "react-icons/io5";
import { IoEyeOff } from "react-icons/io5";
import { useNavigate } from 'react-router-dom';
import { UserDataContext } from '../ContextApi/Usercontext';
import axios from 'axios';

const Signpage = () => {

    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { serverUrl, setUserData } = React.useContext(UserDataContext);

    const HandleSignUp = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const result = await axios.post(`${serverUrl}/api/auth/signup`, {
                name,
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
            <img className='pointer-events-none absolute inset-y-0 right-[-10%] hidden h-full max-w-none opacity-20 mix-blend-screen lg:block' src={authBg} alt="" />

            <div className='relative z-10 mx-auto grid min-h-screen w-full max-w-7xl gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center'>
                <section className='space-y-6 py-4'>
                    <p className='cinema-kicker'>Cerate AI // Launch Sequence</p>
                    <h1 className='cinema-heading max-w-4xl'>
                        Build a <span className='text-cyan-300'>voice companion</span> that feels like it walked out of a sci-fi command deck.
                    </h1>
                    <p className='cinema-copy'>
                        Create your account, cast the face, lock in the wake-word, and bring a cinematic assistant online across mobile, tablet, and desktop.
                    </p>

                    <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                        <div className='cinema-panel cinema-panel-tilt p-5'>
                            <p className='cinema-kicker'>Voice DNA</p>
                            <p className='mt-3 text-xl font-semibold text-white'>Custom wake-word activation</p>
                            <p className='mt-2 text-sm text-white/70'>Choose the name your assistant listens for, then let it answer like a real character.</p>
                        </div>
                        <div className='cinema-panel cinema-panel-tilt p-5'>
                            <p className='cinema-kicker'>Visual Casting</p>
                            <p className='mt-3 text-xl font-semibold text-white'>Preset or uploaded avatar</p>
                            <p className='mt-2 text-sm text-white/70'>Every setup screen is responsive and tuned to feel tactile on smaller devices.</p>
                        </div>
                        <div className='cinema-panel cinema-panel-tilt p-5 sm:col-span-2 xl:col-span-1'>
                            <p className='cinema-kicker'>Mission Feel</p>
                            <p className='mt-3 text-xl font-semibold text-white'>3D surfaces and cinematic lighting</p>
                            <p className='mt-2 text-sm text-white/70'>The entire UI is styled to feel like your own personal assistant control room.</p>
                        </div>
                    </div>
                </section>

                <section className='cinema-panel cinema-panel-strong p-5 sm:p-7 lg:p-8'>
                    <div className='mb-6 space-y-3'>
                        <p className='cinema-kicker'>Register</p>
                        <h2 className='text-3xl font-semibold text-white sm:text-4xl'>
                            Bring your assistant online
                        </h2>
                        <p className='text-sm text-white/70 sm:text-base'>
                            Start your profile, then we&apos;ll guide you through the visual and voice setup flow.
                        </p>
                    </div>

                    <form onSubmit={HandleSignUp} className='flex w-full flex-col gap-4'>
                        <input
                            type="text"
                            placeholder='Enter your name'
                            required
                            onChange={(e) => setName(e.target.value)}
                            value={name}
                            className='cinema-input'
                        />

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
                                autoComplete="new-password"
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
                            {loading ? <span className='btn-loader' aria-label='Loading' /> : "Create Account"}
                        </button>
                    </form>

                    {error.length > 0 && (
                        <p className='mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200'>
                            {error}
                        </p>
                    )}

                    <div className='mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between'>
                        <p className='text-sm text-white/78 sm:text-base'>
                            Already have an account?
                        </p>
                        <button onClick={() => navigate("/login")} className='text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200 transition hover:text-cyan-100 sm:text-[0.8rem]'>
                            Enter the control room
                        </button>
                    </div>
                </section>
            </div>
        </div>
    )
}

export default Signpage
