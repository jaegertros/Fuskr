var Fuskr = (function (ret) {
    'use strict';

    var groupRegex = /\{\d+\}/,
        numericRegex = /^(.*?)\[(\d+)-(\d+)\](.*)$/,
        alphabeticRegex = /^(.*?)\[(\w)-(\w)\](.*)$/;

    function padString(number, stringLength, padding) {
        var numStr = number.toString();
        if (!padding) {
            return numStr;
        }

        while (numStr.length < stringLength) {
            numStr = padding + numStr;
        }

        return numStr;
    }

    function getAlphabeticalUrls(prefix, suffix, startString, endString, groupNumber) {
        var i,
            link,
            links,
            retUrls = [],
            thisNumString,
            startNumber = ret.ConvertCharToInt(startString),
            endNumber = ret.ConvertCharToInt(endString);

        while (startNumber <= endNumber) {
            thisNumString = ret.ConvertIntToChar(startNumber);
            link = prefix + thisNumString + suffix;

            if (groupRegex.test(link)) {
                link = link.replace(new RegExp('\\{' + groupNumber + '\\}', 'g'), thisNumString);
            }

            if (ret.IsFuskable(link)) {
                links = ret.GetLinks(link, groupNumber + 1);
                for (i = 0; i < links.length; i += 1) {
                    retUrls.push(links[i]);
                }
            } else {
                retUrls.push(link);
            }

            startNumber += 1;
        }

        return retUrls;
    }

    function getNumericUrls(prefix, suffix, startNumString, endNumString, groupNumber) {
        var i,
            link,
            links,
            retUrls = [],
            thisNumString,
            startNumber = parseInt(startNumString, 10),
            endNumber = parseInt(endNumString, 10),
            paddedLength = startNumString.length;

        while (startNumber <= endNumber) {
            thisNumString = padString(startNumber, paddedLength, '0');
            link = prefix + thisNumString + suffix;

            if (groupRegex.test(link)) {
                link = link.replace(new RegExp('\\{' + groupNumber + '\\}', 'g'), thisNumString);
            }

            if (ret.IsFuskable(link)) {
                links = ret.GetLinks(link, groupNumber + 1);
                for (i = 0; i < links.length; i += 1) {
                    retUrls.push(links[i]);
                }
            } else {
                retUrls.push(link);
            }

            startNumber += 1;
        }

        return retUrls;
    }

    ret.ConvertIntToChar = function (i) {
        return String.fromCharCode(i);
    };

    ret.ConvertCharToInt = function (a) {
        return a.charCodeAt();
    };

    ret.IsAlphabetical = function (url) {
        return alphabeticRegex.test(url);
    };

    ret.IsNumeric = function (url) {
        return numericRegex.test(url);
    };

    ret.IsFuskable = function (url) {
        return numericRegex.test(url) || alphabeticRegex.test(url);
    };

    ret.GetLinks = function (url, groupNumber) {
        var matches, links = [];

        groupNumber = groupNumber || 0;

        if (!ret.IsFuskable(url)) {
            return links;
        }

        if (ret.IsNumeric(url)) {
            matches = numericRegex.exec(url);
            links = getNumericUrls(matches[1], matches[4], matches[2], matches[3], groupNumber);
        } else if (ret.IsAlphabetical(url)) {
            matches = alphabeticRegex.exec(url);
            links = getAlphabeticalUrls(matches[1], matches[4], matches[2], matches[3], groupNumber);
        }

        return links;
    };

    ret.CreateFuskUrl = function (url, count, direction) {
        var begin, number, end, firstNum, lastNum, findDigitsRegexp, digitsCheck;

        findDigitsRegexp = /^(.*?)(\d+)([^\d]*)$/;
        digitsCheck = findDigitsRegexp.exec(url);

        begin = digitsCheck[1];
        number = digitsCheck[2];
        end = digitsCheck[3];

        firstNum = parseInt(number, 10);
        lastNum = firstNum;

        if (direction === 0) {
            firstNum -= count;
            lastNum += count;
        } else if (direction === -1) {
            firstNum -= count;
        } else if (direction === 1) {
            lastNum += count;
        }

        firstNum = (firstNum < 0 ? 0 : firstNum).toString();
        lastNum = (lastNum < 0 ? 0 : lastNum).toString();

        while (firstNum.length < number.length) {
            firstNum = '0' + firstNum;
        }

        while (lastNum.length < firstNum.length) {
            lastNum = '0' + lastNum;
        }

        return begin + '[' + firstNum + '-' + lastNum + ']' + end;
    };

    ret.GetImageFilename = function (url) {
        if (typeof url === 'undefined' || url === '') {
            return '';
        }

        return url.substring(url.lastIndexOf('/') + 1);
    };

    return ret;
}(Fuskr || {}));

/* globals angular */

(function () {
    'use strict';

    angular
        .module('fuskrApp', ['ngSanitize'])
        .run(['$rootScope', '$filter', function ($rootScope, $filter) {
            $rootScope.manifestName = $filter('translate')('ManifestName', '');
            $rootScope.manifestLanguage = $filter('translate')('ManifestLanguage', '');
        }]);

}());

/* globals angular, JSZip, saveAs, prompt */

(function () {
    'use strict';

    angular
        .module('fuskrApp')
        .controller('ImageListController', ['$document', '$scope', '$location', '$timeout', '$filter', 'anchorScrollService', 'fuskrService', 'chromeService', imageListController]);

    function imageListController($document, $scope, $location, $timeout, $filter, anchorScrollService, fuskrService, chromeService) {
        /* jshint validthis: true */

        var vm = this;

        //Functions
        vm.totalSuccess = totalSuccess;
        vm.totalFailed = totalFailed;
        vm.isFinishedLoading = isFinishedLoading;
        vm.scrollToAnchor = scrollToAnchor;
        vm.shouldDisplayImage = shouldDisplayImage;
        vm.pluraliseForImages = pluraliseForImages;
        vm.downloadZip = downloadZip;
        vm.fuskUrlChanged = fuskUrlChanged;
        vm.changeFusk = changeFusk;
        vm.buildFusk = buildFusk;

        //Initialise
        $timeout(function () {
            var url = $location.hash();
            vm.model = {
                images: [],
                imageUrls: '',
                filteredImages: [],
                originalUrl: url,
                fuskUrl: url,
                showViewer: false,
                showImageUrls: false,
                showBrokenImages: false,
                fuskUrlDifferent: false,
                selectedImageId: 0,
                imageDisplay: 'images-fit-on-page',
                lightOrDark: 'lightMode'
            };

            $document[0].title += ' - ' + vm.model.originalUrl;

            chromeService.getDarkMode().then(function(response) {
                if (response) {
                    vm.model.lightOrDark = 'darkMode';
                }
            });

            buildFusk();

            $document.bind('keydown', keyboardBinding);
        }());

        // Lambda functions
        function totalSuccess() {
            return vm.model.images.map(function (x) {
                return x.loaded && x.success ? 1 : 0;
            }).reduce(function (a, b) {
                return a + b;
            }, 0);
        }

        function totalFailed() {
            return vm.model.images.map(function (x) {
                return x.loaded && !x.success ? 1 : 0;
            }).reduce(function (a, b) {
                return a + b;
            }, 0);
        }

        function isFinishedLoading() {
            return vm.model.images.every(function (x) { return x.loaded; });
        }

        function scrollToAnchor($event, htmlElementId, itemId) {
            if (typeof $event.preventDefault !== 'undefined') {
                $event.preventDefault();
            }

            if (itemId < 0 || !itemId) {
                itemId = 0;
            }

            if (itemId > vm.model.filteredImages.length - 1) {
                itemId = vm.model.filteredImages.length - 1;
            }

            vm.model.selectedImageId = itemId;

            if (htmlElementId) {
                anchorScrollService.scrollTo(htmlElementId);
            }
        }

        function shouldDisplayImage() {
            return function (img) {
                return !img.loaded || img.success || vm.model.showBrokenImages;
            };
        }

        function pluraliseForImages(key) {
            return {
                0: $filter('translate')(key),
                one: $filter('translate')(key),
                other: $filter('translate')(key)
            };
        }

        function keyboardBinding(e) {
            //If the focus is the textbox, do not do anything here.
            if (document.activeElement.className.includes('fusk-url-textbox')) {
                return true;
            }

            switch (e.which) {
                case 37:
                    /* Left */
                    e.preventDefault();
                    $scope.$apply(function () {
                        scrollToAnchor(e, 'image' + (vm.model.selectedImageId - 1), vm.model.selectedImageId - 1);
                    });
                    break;
                case 39:
                    /* Right */
                    e.preventDefault();
                    $scope.$apply(function () {
                        scrollToAnchor(e, 'image' + (vm.model.selectedImageId + 1), vm.model.selectedImageId + 1);
                    });
                    break;
                case 27:
                    /* Escape */
                    e.preventDefault();
                    $scope.$apply(function () {
                        vm.model.showViewer = !vm.model.showViewer;
                    });
                    break;
            }
        }

        function downloadZip() {
            var zip, validImages, explodedPaths, shortenedPathImages, imageUrlsForTxtFile = '', index = 0;

            validImages = vm.model.images.filter(function (x) {
                return x.loaded && x.success;
            });

            // Split each URL into path components
            explodedPaths = validImages.map(function (x) {
                return {
                    url: x.url,
                    data: x.data,
                    urlArray: x.url.split('/').map(safeFileName)
                };
            });

            // Check that all URL components at an index are the same, to determine the root folder
            function checkIfAllItemsAtIndexEqual(x) {
                var pass, allSame;
                pass = explodedPaths.map(function (r) {
                    return r.urlArray.length > x ? r.urlArray[index] : null;
                });

                allSame = pass.every(function (r) {
                    return r === pass[0];
                });

                return allSame;
            }

            for (index = 0; index < validImages.length; index++) {
                if (checkIfAllItemsAtIndexEqual(index) === false) {
                    break;
                }
            }

            // Trim the URL up until the common folder and add it to zip text file.
            shortenedPathImages = explodedPaths.map(function (r) {
                imageUrlsForTxtFile += r.url + '\r\n';
                return {
                    data: r.data,
                    url: r.urlArray.slice(index).join('/')
                };
            });

            function addExtensionIfNeeded(filename, blobData) {
                var expected, types;

                types = {
                    'image/gif': ['gif'],
                    'image/jpeg': ['jpeg', 'jpg'],
                    'image/png': ['png'],
                    'image/tiff': ['tif', 'tiff'],
                    'image/vnd.wap.wbmp': ['wbmp'],
                    'image/x-icon': ['ico'],
                    'image/x-jng': ['jng'],
                    'image/x-ms-bmp': ['bmp'],
                    'image/svg+xml': ['svg'],
                    'image/webp': ['webp']
                };

                // Get expected extension
                expected = types[blobData.type];
                if (expected) {
                    // Iterate through expected types
                    // to check if it matches any on the list
                    var hasMatch = expected.some(function (x) {
                        return filename.match(new RegExp('\\.' + x + '$'));
                    });

                    if (!hasMatch) {
                        // If no extension matches, add one
                        return filename + '.' + expected[0];
                    }
                }

                // If an acceptable extension or no known
                // mimetype, just return
                return filename;
            }

            function safeFileName(str) {
                return str.replace(/[^a-zA-Z0-9_\-.]/g, '_');
            }

            zip = new JSZip();
            zip.file('Fuskr.txt', 'These images were downloaded using Fuskr.\r\n\r\nFusk Url: ' + vm.model.originalUrl + '\r\n\r\n\r\nUrls:\r\n' + imageUrlsForTxtFile);

            // Add an extension for known file types and remove any trailing slash
            shortenedPathImages.forEach(function (img) {
                var fileName = addExtensionIfNeeded(img.url.replace(/\/$/, ''), img.data);
                zip.file(fileName, img.data, { blob: true });
            });

            zip
                .generateAsync({ type: 'blob' })
                .then(function (content) {
                    var zipFilename = prompt('Please enter the name of the generated zip file to download.\nChoosing cancel will abort the zip file download.', 'fuskr.zip');

                    if (zipFilename === '') {
                        //User has cancelled out.
                        return;
                    }

                    //Ensure correct extension.
                    if (!zipFilename.toLowerCase().endsWith('.zip')) {
                        zipFilename += '.zip';
                    }

                    saveAs(content, zipFilename);
                });
        }

        function fuskUrlChanged() {
            var manualCheck, alphabetCheck;

            vm.model.fuskUrlDifferent = false;
            manualCheck = /\[\d+(-\d+)?\]/;
            alphabetCheck = /\[\w(-\w)?\]/;

            //Check whether it's different. Don't try and be smart by doing case insensitivity.
            if (vm.model.fuskUrl === vm.model.originalUrl) {
                return false;
            }

            //We should validate the url.
            if (manualCheck.exec(vm.model.fuskUrl) === null && alphabetCheck.exec(vm.model.fuskUrl) === null) {
                return false;
            }

            //Only if the fusk is valid and is different to the original do we allow the user to resubmit the fusk.
            vm.model.fuskUrlDifferent = true;
        }

        function changeFusk() {
            //Update the url hash.
            $location.hash(vm.model.fuskUrl);

            //Execute the new fusk.
            buildFusk();
        }

        function buildFusk() {
            var urls = '', images = fuskrService.getLinks(vm.model.fuskUrl);
            vm.model.images = images;
            vm.model.filteredImages = images;

            if (images.length > 200) {
                //We should warn the user about a fusk which could potentially kick their computer's arse.
                //The user should be offered the chance to disable this warning.
                //The user can either:
                //  A: Cancel the fusk, which would then close the tab.
                //  B: Continue running the fusk as normal.
                //  C: Ask us to process the fusk in batches of 100 images at a time.
            }

            //Reset vars.
            vm.model.selectedImageId = 0;
            vm.model.fuskUrlDifferent = false;
            vm.model.originalUrl = vm.model.fuskUrl;

            vm.model.images.map(function(x) {
                urls += x.url + '\n';
            });
            vm.model.imageUrls = urls;
        }
    }

}());

/* globals angular */

(function () {
    'use strict';

    angular
        .module('fuskrApp')
        .filter('translate', translateFilter);

    translateFilter.$inject = ['chromeService'];

    function translateFilter(chromeService) {
        return function (name, base) {
            base = typeof (base) === 'undefined' ? 'Images_' : (base === '' ? '' : base + '_');
            return chromeService.getMessage(base + name);
        };
    }

}());

/* globals self, document, setTimeout, angular */

(function () {
    'use strict';

    angular
        .module('fuskrApp')
        .factory('anchorScrollService', AnchorScrollService);

    function AnchorScrollService() {
        return {
            scrollTo: scrollTo
        };

        function scrollTo(elementId) {
            // This scrolling function is from http://www.itnewb.com/tutorial/Creating-the-Smooth-Scroll-Effect-with-JavaScript
            var i, elm, startY, stopY, distance, speed, step, leapY, timer;

            //Check if the required element actually exists.
            elm = document.getElementById(elementId);
            if (elm === null) {
                return;
            }

            i = 0;
            startY = currentYPosition();
            stopY = elmYPosition(elm);
            distance = stopY > startY ? stopY - startY : startY - stopY;
            if (distance < 100) {
                scrollTo(0, stopY);
                return;
            }
            speed = Math.round(distance / 100);

            if (speed >= 20) {
                speed = 20;
            }

            step = Math.round(distance / 25);
            leapY = stopY > startY ? startY + step : startY - step;
            timer = 0;

            if (stopY > startY) {
                for (i = startY; i < stopY; i += step) {
                    setTimeout('window.scrollTo(0, ' + leapY + ')', timer * speed);
                    leapY += step;
                    if (leapY > stopY) {
                        leapY = stopY;
                    }
                    timer++;
                }
                return;
            }

            for (i = startY; i > stopY; i -= step) {
                setTimeout('window.scrollTo(0, ' + leapY + ')', timer * speed);
                leapY -= step;
                if (leapY < stopY) {
                    leapY = stopY;
                }
                timer++;
            }

            function currentYPosition() {
                return self.pageYOffset;
            }

            function elmYPosition(elm) {
                var node, y = -1;
                y = elm.offsetTop;
                node = elm;
                while (node.offsetParent && node.offsetParent !== document.body) {
                    node = node.offsetParent;
                    y += node.offsetTop;
                }
                return y;
            }

        }
    }
}());

/* globals chrome, angular */

(function () {
    'use strict';

    angular
        .module('fuskrApp')
        .factory('chromeService', ChromeService);

    function ChromeService() {
        return {
            getMessage: getMessage,
            getDarkMode: getDarkMode
        };

        function getMessage(name) {
            return chrome.i18n.getMessage(name);
        }

        function getDarkMode () {
            var darkModePromise = new Promise(function (resolve, reject) {
                var result = false;
                try {
                    chrome.storage.sync.get(['darkMode'], function (response) {
                        if (typeof response !== 'undefined' && response.hasOwnProperty('darkMode')) {
                            result = JSON.parse(response.darkMode.toString().toLowerCase());
                            resolve(result);
                        }
                    });
                } catch (err) {
                    reject(err);
                }
            });

            return darkModePromise;
        }
    }
}());

/* globals Fuskr, URL, angular */

(function () {
    'use strict';

    angular
        .module('fuskrApp')
        .factory('fuskrService', FuskrService);

    FuskrService.$inject = ['$http'];

    function FuskrService($http) {

        var disallowedTypes = {
            'text/html': ['html'],
            'text/plain': ['plain']
        };

        return {
            getLinks: getLinks
        };

        function getLinks(url) {
            var mappedLinks = [],
                fuskLinks = Fuskr.GetLinks(url);

            mappedLinks.originalUrl = url;
            mappedLinks.totalLoaded = 0;
            mappedLinks.totalSuccess = 0;
            mappedLinks.totalFailed = 0;
            mappedLinks.finishedLoading = false;

            fuskLinks.forEach(function (url, i) {
                var imageItem =  {
                    url: url,
                    loaded: false,
                    success: false,
                    active: (i === 0),
                    src: null,
                    contentType: '',
                    filename: Fuskr.GetImageFilename(url)
                };

                $http({
                    url: imageItem.url,
                    responseType: 'blob',
                    method: 'GET',
                }).then(function (response) {
                    imageItem.success = (response.status >= 200 && response.status < 400);
                    imageItem.loaded = true;
                    imageItem.src = (response.data) ? URL.createObjectURL(response.data) : null;
                    imageItem.data = response.data;
                    imageItem.contentType = (response.data) ? response.data.type : '';

                    mappedLinks.totalLoaded = mappedLinks.totalLoaded + 1;
                    mappedLinks.finishedLoading = mappedLinks.totalLoaded === fuskLinks.length;

                    //Perform checks on successful images, such as its content type.
                    if (disallowedTypes[imageItem.contentType]) {
                        imageItem.success = false;
                        mappedLinks.totalFailed = mappedLinks.totalFailed + 1;
                    } else {
                        mappedLinks.totalSuccess = mappedLinks.totalSuccess + 1;
                    }
                }, function (response) {
                    imageItem.success = false;
                    imageItem.loaded = true;
                    imageItem.contentType = (response.data) ? response.data.type : '';

                    mappedLinks.totalLoaded = mappedLinks.totalLoaded + 1;
                    mappedLinks.totalFailed = mappedLinks.totalFailed + 1;
                    mappedLinks.finishedLoading = mappedLinks.totalLoaded === fuskLinks.length;
                });

                mappedLinks.push(imageItem);
            });

            return mappedLinks;
        }
    }
}());

//# sourceMappingURL=app.js.map