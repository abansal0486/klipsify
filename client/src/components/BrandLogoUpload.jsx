import { useState } from "react";

export default function BrandLogoUpload({ setLogo }) {

  const [preview,setPreview]=useState(null);

  const upload=(e)=>{
    const file=e.target.files[0];

    if(file){
      setPreview(URL.createObjectURL(file));
      setLogo(file);
    }
  };

  return (
    <div className="mt-8">

      <p className="font-medium mb-3">
        Brand Logo
      </p>

      <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl h-44 cursor-pointer hover:bg-gray-50">

        <input type="file" className="hidden" onChange={upload}/>

        {preview ? (
          <img src={preview} className="h-20"/>
        ) : (
          <p className="text-gray-400">
            Upload logo
          </p>
        )}

      </label>

    </div>
  );
}