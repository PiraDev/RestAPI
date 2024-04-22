const express = require('express')

const app = express()

app.listen(4000, ()=> {
    console.log("Rodando na porta 4000")
    })

    app.get('/',(request,response)  => {
        response.send("HEELO")
    })