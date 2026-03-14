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
    <div className='scene-shell px-4 py-5 sm:px-6 sm:py-6 lg:px-8'>
      <div className='relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6'>
        <div className='grid gap-5 xl:grid-cols-[1.2fr_0.8fr]'>
          <section className='cinema-panel cinema-panel-strong p-5 sm:p-7 lg:p-8'>
            <div className='flex items-start gap-4'>
              <button
                type="button"
                className='holo-button-secondary flex h-11 w-11 items-center justify-center p-0 text-white'
                onClick={() => navigate("/")}
              >
                <IoMdArrowRoundBack className='h-6 w-6' />
              </button>
              <div className='space-y-4'>
                <p className='cinema-kicker'>Avatar Forge // Step 01</p>
                <h1 className='cinema-heading max-w-3xl'>
                  Sculpt a <span className='text-cyan-300'>screen-worthy face</span> for your assistant.
                </h1>
                <p className='cinema-copy'>
                  Pick a preset or upload your own image. The card deck is tuned to feel like a casting console, so every option stays crisp and tactile on phone, tablet, and desktop.
                </p>
                <div className='flex flex-wrap gap-3'>
                  <span className='status-pill status-pill-cyan'>Responsive grid ready</span>
                  <span className='status-pill status-pill-blue'>3D hover depth</span>
                  <span className='status-pill status-pill-amber'>Upload supported</span>
                </div>
              </div>
            </div>
          </section>

          <aside className='cinema-panel cinema-panel-tilt p-5 sm:p-6'>
            <p className='cinema-kicker'>Selection Deck</p>
            <div className='mt-4 space-y-4'>
              <div className='overflow-hidden rounded-[1.6rem] border border-white/10 bg-[rgba(8,18,36,0.7)] shadow-[0_24px_60px_rgba(2,6,23,0.4)]'>
                <div className='relative aspect-[4/3]'>
                  <img
                    src={frontendImage || selectedImage || image1}
                    alt="Assistant preview"
                    className='h-full w-full object-cover'
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-white/10' />
                  <div className='absolute bottom-0 left-0 right-0 flex items-center justify-between p-4'>
                    <span className='rounded-full border border-white/20 bg-black/45 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cyan-100'>
                      {frontendImage ? "Custom Upload" : "Preset Frame"}
                    </span>
                    <span className='rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cyan-100'>
                      Ready
                    </span>
                  </div>
                </div>
              </div>
              <p className='cinema-copy max-w-none text-sm sm:text-base'>
                {frontendImage || selectedImage
                  ? "Visual profile armed. Move to the next step to give your assistant a wake name and bring the character online."
                  : "Choose any frame below to load it into the preview deck before you continue."}
              </p>
              <button className='holo-button w-full text-sm sm:text-base'
                onClick={() =>
                  navigate("/customize2", {
                    state: isEditingAssistant
                      ? { allowAssistantCustomization: true }
                      : null,
                  })
                }
              >
                Continue to Voice Identity
              </button>
            </div>
          </aside>
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
        <button
          type="button"
          className={`avatar-option aspect-[2/3] w-full max-w-[220px] flex items-center justify-center ${selectedImage === "input" ? 'avatar-option-selected' : ''}`}
          onClick={() => {
            inputImage.current.click();
            setSelectedImage("input")
          }
        >
          {!frontendImage && <RiImageAddLine className='text-cyan-100 h-8 w-8' />}
          {/*  if frontendImage is presnet then show it */}
          {frontendImage && <img src={frontendImage} alt="Preview" className='h-full w-full object-cover rounded-2xl' />}
          <div className="avatar-option-meta">
            <span className="avatar-option-label">Upload</span>
            <span className="avatar-option-signal">{frontendImage ? "Synced" : "Import"}</span>
          </div>
        </button>
        <input type="file" accept='image/*' ref={inputImage} hidden onChange={handleChange} />
        </div>
      </div>
    </div>
  )
}

export default Customize
