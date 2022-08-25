const PULL_REQUEST_PATH_REGEXP = /.+\/([^/]+)\/(pull)\/[^/]+\/(.*)/;

function getOptions() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get({
            remoteHost: '',
            basePath: '',
            insidersBuild: false,
            debug: false,
        }, (options) => {
            if (options.basePath === '') {
                reject(new Error('Looks like you haven\'t configured this extension yet. You can find more information about this by visiting the extension\'s README page.'));
                chrome.runtime.openOptionsPage();
                return;
            }

            resolve(options);
        });
    });
}

function getVscodeLink({
    repo, file, isFolder, line,
}) {
    return getOptions()
        .then(({
            insidersBuild,
            remoteHost,
            basePath,
            debug,
        }) => {
            let vscodeLink = insidersBuild
                ? 'vscode-insiders'
                : 'vscode';

            // vscode://vscode-remote/ssh-remote+[host]/[path/to/file]:[line]
            // OR
            // vscode://file/[path/to/file]:[line]
            if (remoteHost !== '') {
                vscodeLink += `://vscode-remote/ssh-remote+${remoteHost}`;
            } else {
                vscodeLink += '://file';
            }

            // windows paths don't start with slash
            if (basePath[0] !== '/') {
                vscodeLink += '/';
            }

            vscodeLink += `${basePath}/${repo}/${file}`;

            // opening a folder and not a file
            if (isFolder) {
                vscodeLink += '/';
            }

            if (line) {
                vscodeLink += `:${line}:1`;
            } else {
                // We need a default especially for remote hosts
                // because vscode will open a new project if we don't provide
                // a line number for remote projects
                vscodeLink += ':0:1';
            }

            if (debug) {
                alert(`About to open link: ${vscodeLink}`);
            }

            return vscodeLink;
        });
}

function isPR(linkUrl) {
    return PULL_REQUEST_PATH_REGEXP.test(linkUrl);
}

function parseLink(linkUrl, selectionText, pageUrl) {
    return new Promise((resolve, reject) => {
        const url = new URL(linkUrl ?? pageUrl);
        const path = url.pathname;

        if (isPR(url.pathname)) {
            const pathInfo = PULL_REQUEST_PATH_REGEXP.exec(path);
            const repo = pathInfo[1];
            const isFolder = false;
            const file = selectionText;
            let line = null;
            if (pageUrl.includes(linkUrl)) {
                line = pageUrl.replace(linkUrl, '').replace('R', '').replace('L', '');
            }
            resolve({
                repo,
                file,
                isFolder,
                line,
            });
            return;
        }

        const pathRegexp = /.+\/([^/]+)\/(blob|tree)\/[^/]+\/(.*)/;

        if (!pathRegexp.test(path)) {
            reject(new Error(`Invalid link. Could not extract info from: ${path}.`));
            return;
        }

        const pathInfo = pathRegexp.exec(path);

        const repo = pathInfo[1];
        const isFolder = pathInfo[2] === 'tree';
        const file = pathInfo[3];

        let line;

        if (url.hash.indexOf('#L') === 0) {
            line = url.hash.substring(2);
        }

        resolve({
            repo,
            file,
            isFolder,
            line,
        });
    });
}

async function openFile({ linkUrl, selectionText, pageUrl}) {
    // let download_to_open = await download(linkUrl)
    // var xhr = new XMLHttpRequest();
    // xhr.open('GET', 'file:///Users/sayyant/downloads/test_data.json')
    // xhr.responseType = 'json'

    // console.log("HERE")
    // xhr.onload = function(e) {
    //     var json_obj = (this.response)
    //     console.log(json_obj)
    // }
    getTestData = await fetch(linkUrl, {
        method: "GET",
        mode: "cors",
        headers: {
            'Content-Type': 'application/json'
        }
    })
    console.log(getTestData)
}

function download(url) {
    return new Promise(resolve => chrome.downloads.download({url}, resolve));
  }

const openInVscode = ({ linkUrl, selectionText, pageUrl }) => {
    if (selectionText == "test_data.json") {
        openFile({linkUrl, selectionText, pageUrl})
    } else {
        parseLink(linkUrl, selectionText, pageUrl)
            .then(getVscodeLink)
            .then((VSCodeLink) => chrome.tabs.create({url: VSCodeLink}))
            .catch(alert);
    }
}

chrome.contextMenus.create({
    id: "open-in-vscode",
    title: 'Open in VSCode',
    contexts: ['link', 'page'],
});

chrome.contextMenus.onClicked.addListener(((info) => {
    openInVscode({ linkUrl: info.linkUrl, selectionText: info.selectionText, pageUrl: info.pageUrl });
}));

chrome.action.onClicked.addListener((({ url }) => {
    openInVscode({ linkUrl: url, pageUrl: url });
}));