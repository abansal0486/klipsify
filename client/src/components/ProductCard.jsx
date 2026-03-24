import { useState } from "react";

export default function ProductCard({ product,index,brand,updateField }){

  const [preview,setPreview]=useState(null);

  const updateProduct=(field,value)=>{

    const products=[...brand.products];
    products[index][field]=value;

    updateField("products",products);
  };

  const upload=(e)=>{
    const file=e.target.files[0];

    if(file){
      setPreview(URL.createObjectURL(file));
      updateProduct("image",file);
    }
  };

  return (
    <div className="border rounded-xl p-4 mb-4 bg-white">

      <div className="grid grid-cols-2 gap-4">

        <input
          placeholder="Product Name"
          className="pro-input"
          onChange={(e)=>updateProduct("name",e.target.value)}
        />

        <label className="border rounded-lg flex items-center justify-center cursor-pointer">

          <input type="file" className="hidden" onChange={upload}/>

          {preview ? (
            <img src={preview} className="h-16"/>
          ) : (
            <p className="text-xs text-gray-400">
              Upload Image
            </p>
          )}

        </label>

      </div>

    </div>
  );
}