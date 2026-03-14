import { useContext } from 'react'
import React, { useRef } from 'react'
import { RiImageAddLine } from 'react-icons/ri'
import Card from '../components/Card'
import image1 from '../assets/images/image1.png'
import image2 from '../assets/images/image2.jpg'
import image4 from '../assets/images/image4.png'
import image5 from '../assets/images/image5.png'
import image6 from '../assets/images/image6.jpeg'
import image7 from '../assets/images/image7.jpeg'
import authBg from '../assets/images/authBg.png'
import { UserDataContext } from "../ContextApi/Usercontext"
import { useLocation, useNavigate } from 'react-router-dom'
import { IoMdArrowRoundBack } from "react-icons/io";


const Customize = () => {

  const { setFrontendImage, setbackendImage, frontendImage, selectedImage, setSelectedImage } = useContext(UserDataContext);
  const inputImage = useRef();

  const navigate = useNavigate();
  const location = useLocation();
  const isEditingAssistant = Boolean(location.state?.allowAssistantCustomization);

  const handleChange = (e) => {
    const file = e.target.files[0];
    setbackendImage(file);
    // now the frontendimage is the url of the backend image and we can use it to show the preview of the image to the user
    setFrontendImage(URL.createObjectURL(file))

  }
  return (
    <div className='min-h-screen w-full bg-gradient-to-t from-[black] to-[#09094d] px-4 py-6 sm:px-6 sm:py-8 lg:px-8'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
        <div className='flex items-center gap-3'>
          <button
            type="button"
            className='flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20'
            onClick={() => navigate("/")}
          >
            <IoMdArrowRoundBack className='h-6 w-6' />
          </button>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/70'>Step 1</p>
            <h1 className='text-2xl font-bold text-white sm:text-3xl lg:text-4xl'>
              Choose your <span className="text-blue-400">assistant&apos;s avatar</span>
            </h1>
          </div>
        </div>

        <div className='grid w-full grid-cols-2 justify-items-center gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 xl:gap-5'>
        <Card image={image1} />
        <Card image={image2} />
        <Card image={authBg} />
        <Card image={image4} />
        <Card image={image5} />
        <Card image={image6} />
        <Card image={image7} />

        {/* now putting the section where user can use their own image to set the assisant */}
        <div className={`aspect-[2/3] w-full max-w-[220px] bg-[#030326] border-2 border-[blue] rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-950 hover:border-4 hover:border-[white] flex justify-center items-center flex-col gap-3 ${selectedImage === "input" ? 'border-4 border-[white] shadow-2xl shadow-blue-950' : ''}`}
          onClick={() => {
            inputImage.current.click();
            setSelectedImage("input")
          }
          }
        >

          {!frontendImage && <RiImageAddLine className='text-white w-[25px] h-[25px]'></RiImageAddLine>}
          {/*  if frontendImage is presnet then show it */}
          {frontendImage && <img src={frontendImage} alt="Preview" className='h-full w-full object-cover rounded-2xl' />}

        </div>
        <input type="file" accept='image/*' ref={inputImage} hidden onChange={handleChange} />
        </div>

        <div className='flex justify-center pt-2 sm:pt-4'>
          <button className='min-h-12 w-full max-w-sm rounded-full bg-white px-6 py-3 text-base font-semibold text-black transition hover:bg-blue-100 sm:text-lg'
            onClick={() =>
              navigate("/customize2", {
                state: isEditingAssistant
                  ? { allowAssistantCustomization: true }
                  : null,
              })
            }
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

export default Customize
