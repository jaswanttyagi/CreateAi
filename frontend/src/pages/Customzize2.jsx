import React, { useContext, useState } from 'react'
import { UserDataContext } from '../ContextApi/Usercontext';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { IoMdArrowRoundBack } from "react-icons/io";


const Customzize2 = () => {
    const {userData , setUserData , backendImage , selectedImage , serverUrl} = useContext(UserDataContext)
    const [assistantname , setAssistantname] = useState(userData?.assistantName || "" );
    const [loading , setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const isEditingAssistant = Boolean(location.state?.allowAssistantCustomization);

    const handleAssistant = async()=>{
        setLoading(true);
        try{
            let formData = new FormData();
            formData.append("assistantName" , assistantname);
            if(backendImage){
                formData.append("assistantImage" , backendImage);
            }
            else{
                formData.append("imageUrl" , selectedImage);
            }
            const result = await axios.post(`${serverUrl}/api/user/updateAssistant` , formData , {withCredentials : true});
            console.log(result.data);
            setUserData(result.data.user);
            navigate("/");
        }catch(err){
            if(err?.response?.status === 401){
                setUserData(null);
                navigate("/login");
                return;
            }
            console.log(err)
        }finally{
            setLoading(false);
        }
    }
    return (
        <div className='scene-shell px-4 py-5 sm:px-6 sm:py-6 lg:px-8'>
            <div className='relative z-10 mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.1fr_0.9fr]'>
                <section className='cinema-panel cinema-panel-strong p-5 sm:p-7 lg:p-8'>
                    <div className='flex items-start gap-4'>
                        <button
                            type="button"
                            className='holo-button-secondary flex h-11 w-11 items-center justify-center p-0 text-white'
                            onClick={() =>
                                navigate("/customize", {
                                    state: isEditingAssistant
                                        ? { allowAssistantCustomization: true }
                                        : null,
                                })
                            }
                        >
                            <IoMdArrowRoundBack className='h-6 w-6' />
                        </button>
                        <div className='space-y-4'>
                            <p className='cinema-kicker'>Voice Identity // Step 02</p>
                            <h1 className='cinema-heading max-w-3xl'>
                                Give your assistant a <span className='text-cyan-300'>wake phrase</span> worth listening for.
                            </h1>
                            <p className='cinema-copy'>
                                A short, clean name works best. The assistant uses this name as its activation trigger, so clear syllables make the voice experience feel sharper and more reliable across mobile and desktop microphones.
                            </p>
                            <div className='flex flex-wrap gap-3'>
                                <span className='status-pill status-pill-cyan'>Wake-word tuned</span>
                                <span className='status-pill status-pill-blue'>Voice-first flow</span>
                                <span className='status-pill status-pill-amber'>Cross-device ready</span>
                            </div>
                        </div>
                    </div>

                    <div className='mt-8 rounded-[1.9rem] border border-white/10 bg-[rgba(5,10,22,0.58)] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.35)] sm:p-6'>
                        <label className='mb-3 block text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100/80'>
                            Assistant Name
                        </label>
                        <input
                            type="text"
                            placeholder='eg. Jarvis'
                            required
                            value={assistantname}
                            onChange={(e)=>setAssistantname(e.target.value)}
                            className='cinema-input'
                        />

                        <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                            <div className='cinema-panel p-4'>
                                <p className='cinema-kicker'>Wake Preview</p>
                                <p className='mt-3 text-lg font-semibold text-white sm:text-xl'>
                                    {assistantname ? `${assistantname}, are you online?` : "Choose a name to preview the wake phrase."}
                                </p>
                            </div>
                            <div className='cinema-panel p-4'>
                                <p className='cinema-kicker'>Activation Reply</p>
                                <p className='mt-3 text-lg font-semibold text-white sm:text-xl'>
                                    I am activated. Ask me anything.
                                </p>
                            </div>
                        </div>

                        {assistantname && (
                            <button
                                disabled={loading}
                                className='holo-button mt-6 w-full text-sm disabled:cursor-not-allowed disabled:opacity-70 sm:text-base'
                                onClick={()=>{
                                    handleAssistant()
                                }}
                            >
                                {loading ? "Loading..." : isEditingAssistant ? "Update Your Assistant" : "Create Your Assistant"}
                            </button>
                        )}
                    </div>
                </section>

                <aside className='cinema-panel cinema-panel-tilt p-5 sm:p-6'>
                    <p className='cinema-kicker'>Cinematic Preview</p>
                    <div className='assistant-stage mt-4 p-6 sm:p-8'>
                        <div className='assistant-orbit' />
                        <div className='assistant-orbit-secondary' />
                        <div className='assistant-orbit-tertiary' />
                        <div className='assistant-portrait'>
                            <div className='flex h-full w-full items-end justify-start bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.2),_transparent_40%),linear-gradient(180deg,_rgba(10,18,34,0.95),_rgba(4,8,18,0.92))] p-5'>
                                <div className='space-y-2'>
                                    <span className='rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cyan-100'>
                                        Voice Persona
                                    </span>
                                    <p className='text-2xl font-semibold text-white sm:text-3xl'>
                                        {assistantname || "Assistant"}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className='floating-glow' />
                    </div>
                    <p className='cinema-copy mt-4 max-w-none text-sm sm:text-base'>
                        Keep the name distinct from common background words so the assistant wakes up cleanly and feels more cinematic when it responds.
                    </p>
                </aside>
            </div>
        </div>
    )
}

export default Customzize2
