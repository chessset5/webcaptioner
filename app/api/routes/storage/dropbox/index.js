const dropboxRoute = require('express').Router();
const Dropbox = require('dropbox').Dropbox;
const axios = require('axios');
const fetch = require('isomorphic-fetch');
const {format: dateFormat} = require('date-fns');

function getDropboxClient() {
    return new Dropbox({clientId: 'v7642g8xms9wmlf', fetch});
}

dropboxRoute.get('/auth', async (req, res, next) => {
    // Redirect to login page
    const dropboxClient = getDropboxClient();
    res.redirect(302, dropboxClient.getAuthenticationUrl(process.env.HOSTNAME + '/captioner/settings/sync/dropbox-oauth'));
});

dropboxRoute.post('/auth-revoke', async (req, res, next) => {
    const {accessToken} = req.body;

    if (!accessToken) {
        // Missing required params
        res.sendStatus(400);
        return;
    }

    const dropboxClient = getDropboxClient();
    dropboxClient.setAccessToken(accessToken);
    dropboxClient.authTokenRevoke()
        .then(response => {
            res.sendStatus(200);
        })
        .catch(({error}) => {
            res.status(400).send(JSON.stringify({error}));
        });
});

// Get the current user profile
dropboxRoute.get('/profile', async (req, res, next) => {
    const {accessToken, accountId} = req.query;

    if (!accessToken || !accountId) {
        // Missing required params
        res.sendStatus(400);
        return;
    }

    const dropboxClient = getDropboxClient();
    dropboxClient.setAccessToken(accessToken);

    dropboxClient.usersGetAccount({account_id: accountId})
        .then(response => {
            res.json(response);
        })
        .catch(({error}) => {
            res.status(400).send(JSON.stringify({error}));
        });
    
});

dropboxRoute.post('/push', async (req, res) => {
    const {contents, accessToken, sessionStartDate} = req.body;

    if (!contents || !accessToken || !sessionStartDate) {
        // Missing required params
        res.sendStatus(400);
        return;
    }

    const dropboxClient = getDropboxClient();
    dropboxClient.setAccessToken(accessToken);

    dropboxClient.filesUpload({
        path: '/Transcripts/' + dateFormat(sessionStartDate, 'YYYY-MM-DD HH.mm.ss') + '.txt',
        contents,
        mode: 'overwrite',
        mute: true, // don't trigger notification
    })
        .then(function(response) {
            res.sendStatus(200);
        })
        .catch(function(error) {
            res.sendStatus(400);
        });
});

dropboxRoute.get('/transcripts', async (req, res, next) => {
    const {accessToken, cursor} = req.query;
    const MAX_FILE_COUNT = 3000; // stop fetching files if there's over this many

    if (!accessToken) {
        // Missing required param
        res.sendStatus(400);
        return;
    }

    const dropboxClient = getDropboxClient();
    dropboxClient.setAccessToken(accessToken);

    let files = [];

    async function getFiles(cursor) {
        let filesResult;
        
        try {
            if (!cursor) {
                filesResult = await dropboxClient.filesListFolder({
                    path: '/Transcripts',
                    recursive: false,
                    include_media_info: false,
                    include_deleted: false,
                });
            }
            else {
                filesResult = await dropboxClient.filesListFolderContinue({
                    cursor,
                });
            }
        }
        catch({e}) {
            res.status(400).send(JSON.stringify({error}));
            return;
        }

        files = files.concat((filesResult.entries || []).map(entry => {
            return {
                name: entry.name,
                size: entry.size,
                modified: new Date(entry.client_modified).getTime(),
            };
        }));

        if (filesResult.has_more && filesResult.cursor && files.length <= MAX_FILE_COUNT) {
            getFiles(filesResult.cursor);
        }
        else {
            res.json({
                reachedFileCountLimit: files.length > MAX_FILE_COUNT,
                files: files.sort(function (a, b) {
                        // Sort by modified date descending
                        if (a.modified < b.modified) {
                            return 1;
                        }
                        else if (a.modified > b.modified) {
                            return -1;
                        }
                        else {
                            return 0;
                        }
                    }).map(file => { // remove modified property
                        return {
                            name: file.name,
                            size: file.size,
                        }
                    }).slice(0, 500), // return first x only
            });
            return;
        }
    }

    getFiles();
});

dropboxRoute.get('/transcripts/:fileName', async (req, res, next) => {
    const {accessToken} = req.query;
    const {fileName} = req.params;

    if (!accessToken || !fileName) {
        // Missing required param
        res.sendStatus(400);
        return;
    }

    const dropboxClient = getDropboxClient();
    dropboxClient.setAccessToken(accessToken);
    
    dropboxClient.filesGetTemporaryLink({
        path: '/Transcripts/' + fileName + '.txt'
    })
        .then(result => {
            if (result.link) {
                console.log(result);
                res.redirect(result.link);
            }
            else {
                res.sendStatus(400);
            }
        })
        .catch(({error}) => {
            res.status(400).send(JSON.stringify({error}));
        });

});

module.exports = dropboxRoute;