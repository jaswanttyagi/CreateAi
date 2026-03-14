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
        <div className='relative min-h-screen w-full overflow-hidden px-4 py-8 sm:px-6 sm:py-12 lg:px-8'>
            <img className='absolute inset-0 h-full w-full object-cover' src={authBg} alt="Authentication background" />
            <div className='absolute inset-0 bg-black/45 backdrop-blur-[2px]' />

            <div className='relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center sm:min-h-[calc(100vh-6rem)]'>
                <div className='w-full rounded-2xl border border-white/20 bg-black/55 p-6 shadow-2xl shadow-black/60 backdrop-blur-md sm:p-8'>
                    <p className='mb-6 text-center text-xl font-semibold text-white'>
                        Register for <span className='text-blue-300'>Virtual Assistant</span>
                    </p>

                    <form onSubmit={HandleSignUp} className='flex w-full flex-col gap-4'>
                        <input
                            type="text"
                            placeholder='Enter your name'
                            required
                            onChange={(e) => setName(e.target.value)}
                            value={name}
                            className='w-full rounded-xl border border-white/25 bg-white/95 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 sm:text-base'
                        />

                        <input
                            type="email"
                            placeholder='Enter your email'
                            required
                            autoComplete="email"
                            onChange={(e) => setEmail(e.target.value)}
                            value={email}
                            className='w-full rounded-xl border border-white/25 bg-white/95 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 sm:text-base'
                        />

                        <div className='relative'>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                required
                                autoComplete="new-password"
                                onChange={(e) => setPassword(e.target.value)}
                                value={password}
                                className="w-full rounded-xl border border-white/25 bg-white/95 px-4 py-3 pr-12 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 sm:text-base"
                            />

                            {showPassword ? (
                                <IoEyeOff
                                    onClick={() => setShowPassword(false)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
                                    size={20}
                                />
                            ) : (
                                <IoEye
                                    onClick={() => setShowPassword(true)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
                                    size={20}
                                />
                            )}
                        </div>

                        <button
                            disabled={loading}
                            className='mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-gray-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base'
                        >
                            {loading ? <span className='btn-loader' aria-label='Loading' /> : "Sign Up"}
                        </button>
                    </form>

                    {error.length > 0 && <p className='mt-4 text-sm text-red-300'>{error}</p>}

                    <p className='mt-6 text-center text-sm text-white/90 sm:text-base'>
                        Already have an account?{" "}
                        <button onClick={() => navigate("/login")} className='font-semibold text-blue-300 hover:text-blue-200'>
                            Login
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Signpage
