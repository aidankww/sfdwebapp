var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Waites HQN Split Flap Display Control Server' });
});

module.exports = router;
