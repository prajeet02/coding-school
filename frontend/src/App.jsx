import { useEffect, useState } from 'react'
import axios from 'axios'


function App(){
  const [status,setStatus] = useState('Loading...')

  useEffect(() => {
    axios.get("http://localhost:8080/health")
    .then(res => setStatus(res.data.status))
    .catch(() => setStatus("Backend is not running"))
  },[]);

  return (
    <>
      <div>
        <h1>Backend says : {status}</h1>
      </div>
    </>
  )
}

export default App;