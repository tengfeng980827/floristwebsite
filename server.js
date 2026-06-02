const express = require("express");
const app = express();

app.use(express.static("."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Flower demo running on port ${PORT}`);
});