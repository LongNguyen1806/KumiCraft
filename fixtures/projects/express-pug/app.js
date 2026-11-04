// Express + Pug fixture (Phase 4 K4): a server-rendered app the way express-generator and most
// tutorials write one. helmet() sends a CSP and X-Frame-Options, compression() gzips the HTML:
// the KumiCraft proxy must still frame the page and add the Bridge.
const path = require('node:path');

const compression = require('compression');
const express = require('express');
const helmet = require('helmet');

const productsRouter = require('./routes/products');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(helmet());
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Chợ phiên',
    products: [
      { id: 1, name: 'Rau muống', price: '15.000đ' },
      { id: 2, name: 'Cà chua', price: '22.000đ' },
    ],
  });
});

app.get('/about', (req, res) => {
  res.render('about', { title: 'Giới thiệu' });
});

app.use('/products', productsRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Express fixture listening on http://localhost:${port}`);
});
