"use latest"

import Webtask from 'webtask-tools';
import express from 'express';
import crypto from 'crypto';
import multiparty from 'multiparty';
import formData from 'form-data';
import request from 'request';

let app = express();

app.post('/:projectid', (req, res) => {
  const cipher = crypto.createCipher('aes256', req.webtaskContext.secrets.FILE_ENC_CYPHER);

  var form = new multiparty.Form();

  form.on('part', function(part) {

    var formdata = new formData();

    formdata.append("data", part.pipe(cipher), { filename: part.filename, contentType: part["content-type"] });

    var r = request.post(`https://api.graph.cool/file/v1/${req.params.projectid}`, { "headers": {"transfer-encoding": "chunked"} }, function(err,resp,body) {
      var result = JSON.parse(body);

      request.post(
        {
          url: `https://api.graph.cool/simple/v1/${req.params.projectid}`,
          method: 'post',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `
              mutation {
                updateFile (id: "${result.id}", encUrl: "${result.url.replace('files.graph.cool', req.headers.host + '/file')}") {
                  secret
                  name
                  size
                  encUrl
                  id
                  contentType
                }
              }
            `
          })
        },
        function(err,resp,body) {
          res.status(resp.statusCode).send(JSON.parse(body).data.updateFile);
        });
    });

    r._form = formdata;
  });

  form.parse(req);
});

app.get('/:projectid/:fileid', (req, res) => {

  const decipher = crypto.createDecipher('aes256', req.webtaskContext.secrets.FILE_ENC_CYPHER);

  var resource = request.get(`https://files.graph.cool/${req.params.projectid}/${req.params.fileid}`);

  resource.on('response', function(response) {
    res.set(response.headers);
    res.removeHeader('content-length');
  });

  resource.pipe(decipher).pipe(res);
});

export default Webtask.fromExpress(app);
