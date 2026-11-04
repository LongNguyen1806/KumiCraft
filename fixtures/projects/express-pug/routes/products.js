// Router mounted at /products in app.js: the route finder must join the prefix.
const express = require('express');

const router = express.Router();

router.get('/:id', (req, res) => {
  res.render('product', { title: 'Sản phẩm', id: req.params.id });
});

module.exports = router;
