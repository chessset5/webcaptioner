var express = require('express');
var compression = require('compression');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var expressSanitizer = require('express-sanitizer');
var bodyParser = require('body-parser');
var env = require('node-env-file');

var captioner = require('./routes/captioner');
var translate = require('./routes/translate');
var feedback = require('./routes/feedback');
var wlbc = require('./routes/wlbc');
var healthCheck = require('./routes/healthCheck');

var app = express();
app.use('/health-check', healthCheck);


if (process.env.NODE_ENV !== 'dev') {
  // Redirect http to https
  app.use(function(req, res, next) {
    if((!req.secure) && (req.get('X-Forwarded-Proto') !== 'https')) {
      // We're not on HTTPS. AWS sets the X-Forwarded-Proto header from the load balancer.
      res.redirect('https://' + req.get('Host') + req.url);
    }
    else {
      // No redirect necessary; already on HTTPS
      next();
    }
  });
}

// Get environment variables output by CI deploy script
env(path.join(__dirname, 'env/.env'));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(compression())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressSanitizer()); // this line follows bodyParser() instantiations 
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'static/favicon')));
app.use('/web-captioner-title.xaml', express.static(path.join(__dirname, 'static/web-captioner-title.xaml')));
app.use('/build', express.static(path.join(__dirname, 'build')));

app.use('/', express.static(path.join(__dirname, '../static-site/public')));
app.use('/blog', express.static(path.join(__dirname, '../static-site/public/blog')));
app.use('/help', express.static(path.join(__dirname, '../static-site/public/help')));
app.use('/donate', express.static(path.join(__dirname, '../static-site/public/donate')));
app.use('/privacy-policy', express.static(path.join(__dirname, '../static-site/public/privacy-policy')));
app.use('/community', express.static(path.join(__dirname, '../static-site/public/community')));
app.use('/press', express.static(path.join(__dirname, '../static-site/public/press')));
app.use('/testimonials', express.static(path.join(__dirname, '../static-site/public/testimonials')));
app.use('/feedback', express.static(path.join(__dirname, '../static-site/public/feedback')));
app.use('/connector', express.static(path.join(__dirname, '../static-site/public/connector')));
app.use('/vmix', express.static(path.join(__dirname, '../static-site/public/vmix')));

app.use('/static/img', express.static(path.join(__dirname, 'static/img')));

app.use('/captioner', captioner);
app.use('/translate', translate);
app.use('/feedback', feedback);
// app.use('/wlbc', wlbc);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
