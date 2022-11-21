const PageUpdater = function () {
	var timeout;
	var controller = new AbortController();

	return {
		Update: async function (e, enableDebouncing = false) {
			if (!enableDebouncing) {
				var clickedButton = e.currentTarget != undefined ? e.currentTarget : e;
				var form = clickedButton.closest("form");
				var preloader = form.getAttribute("data-preloader");
				var responseTargetElement = form.getAttribute("data-response-target-element") ? "#" + form.getAttribute("data-response-target-element") : "#content";
				responseTargetElement = document.querySelector(responseTargetElement);
				var layoutTemplate = form.getAttribute("data-layout-template") ? form.getAttribute("data-layout-template") : "Swift_PageClean.cshtml";
				let formData = new FormData(form);
				let formObj = this.CleanUpFormData(formData);
				let newFormData = new FormData();
				Object.keys(formObj).forEach(key => newFormData.append(key, formObj[key]));

				newFormData.set("LayoutTemplate", layoutTemplate);
				const signal = controller.signal;
				var fetchOptions = {
					method: 'POST',
					body: newFormData,
					signal: signal
				};

				//Fire the 'update' event
				let event = new CustomEvent("update.swift.pageupdater", {
					cancelable: true,
					detail: {
						formData: newFormData,
						parentEvent: e
					}
				});
				var globalDispatcher = document.dispatchEvent(event);
				var localDispatcher = clickedButton.dispatchEvent(event);

				if (globalDispatcher != false && localDispatcher != false) {
					//UI updates
					var preloaderTargetElement = preloader != "inline" ? form : responseTargetElement;
					var addPreloaderTimer = setTimeout(function () {
						PageUpdater.AddPreloaders(preloader, preloaderTargetElement);
					}, 200); //Small delay to secure that the preloader is not loaded all the time

					//Fetch
					let abortError = false;
					let response;

					const newParams = new URLSearchParams(newFormData); //Get parameters from the form
					var url = new URL(form.action);	//Get the url from the form
					var pageId = url.searchParams.get("ID");

					if (pageId) {
						newParams.set("ID", pageId);
					}
					newParams.set("LayoutTemplate", "Swift_PageClean.cshtml"); //Set template to not include header and footer

					let newUrl = form.action;

					if (form.getAttribute("data-update-url") != undefined ) {
						newUrl = url.origin + url.pathname + "?" + newParams.toString(); //Create url with the new parameters
					}

					response = await fetch(newUrl, fetchOptions).catch(function (error) {
						abortError = true;
					});

					if (!abortError) {
						if (response.ok) {

							//Update URL
							let updateUrl = form.getAttribute("data-update-url") != undefined ? form.getAttribute('data-update-url').toLowerCase() : 'false';
							
							if (updateUrl == 'true') {
								newParams.delete("LayoutTemplate");

								var updatedUrl = window.location.origin + window.location.pathname + "?" + newParams;
								window.history.replaceState({}, '', decodeURI(updatedUrl));
							}

							PageUpdater.Success(response, addPreloaderTimer, formData, responseTargetElement, clickedButton);
						} else {
							PageUpdater.Error(response, addPreloaderTimer);
						}
					}
				}
			} else {
				PageUpdater.Debounce(() => PageUpdater.Update(e, false), 300)()
			}
		},

		CleanUpFormData: function (data) {
			let obj = {};
			for (let [key, value] of data) {
				if (obj[key] !== undefined) {
					if (!Array.isArray(obj[key])) {
						obj[key] = [obj[key]];
					}
					if (value !== '') {
						obj[key].push(value)
					};
				} else {
					if (value !== '') {
						obj[key] = value;
					}
				}
			}
			return obj;
		},

		UpdateFromUrl: async function (e, url) {
			var clickedButton = e.currentTarget != undefined ? e.currentTarget : e;
			var layoutTemplate = clickedButton.getAttribute("data-layout-template") ? clickedButton.getAttribute("data-layout-template") : "Swift_PageClean.cshtml";
			url += "&LayoutTemplate=" + layoutTemplate;

			//By default the UpdateFromUrl simply targets the element that makes the call. But you do also have the choice of setting the target
			var responseTargetElement = clickedButton.getAttribute("data-response-target-element") ? document.querySelector("#" + clickedButton.getAttribute("data-response-target-element")) : clickedButton;

			//Fire the 'update' event
			let event = new CustomEvent("update.swift.pageupdater", {
				cancelable: true,
				detail: {
					parentEvent: e
				}
			});
			var globalDispatcher = document.dispatchEvent(event);
			var localDispatcher = clickedButton.dispatchEvent(event);

			if (globalDispatcher != false && localDispatcher != false) {
				//UI updates
				var addPreloaderTimer = setTimeout(function () {
					PageUpdater.AddPreloaders("inline", responseTargetElement);
				}, 200); //Small delay to secure that the preloader is not loaded all the time

				//Fetch
				let response = await fetch(url);

				if (response.ok) {
					PageUpdater.Success(response, addPreloaderTimer, new FormData(), responseTargetElement, clickedButton);
				} else {
					PageUpdater.Error(response, addPreloaderTimer);
				}
			}
		},

		AddPreloaders: function (type, targetElement, addPreloaderTimer) {	//Private method
			if (type != "inline") {
				var overlayElement = document.createElement('div');
				overlayElement.className = "preloader-overlay";
				overlayElement.setAttribute('id', "overlay");
				var overlayElementIcon = document.createElement('div');
				overlayElementIcon.className = "preloader-overlay-icon";
				overlayElementIcon.style.top = window.pageYOffset + "px";
				overlayElement.appendChild(overlayElementIcon);

				if (targetElement) {
					targetElement.parentNode.insertBefore(overlayElement, targetElement);
				}
			} else {
				if (targetElement != null) {
					targetElement.innerHTML = "";
				}

				var preloaderContainer = document.createElement('div');
				preloaderContainer.className = "w-100 h-100 d-flex justify-content-center align-items-center";
				var preloaderElement = document.createElement('div');
				preloaderElement.className = "icon-1";
				preloaderContainer.appendChild(preloaderElement);
				var preloaderSpinner = document.createElement('div');
				preloaderSpinner.className = "spinner-border m-auto";
				preloaderElement.appendChild(preloaderSpinner);
				var helper = document.createElement('span');
				helper.className = "visually-hidden";
				helper.innerHTML = "Loading...";
				preloaderElement.appendChild(helper);

				if (targetElement != null) {
					targetElement.appendChild(preloaderContainer);
				}
			}
		},

		Success: async function (response, addPreloaderTimer, formData, responseTargetElement, clickedButton) {
			clearTimeout(addPreloaderTimer);

			let html = await response.text().then(function (text) {
				return text;
			});

			//Fire the 'updated' event
			let event = new CustomEvent("updated.swift.pageupdater", {
				cancelable: true,
				detail: {
					formData: formData,
					html: html
				}
			});
			var globalDispatcher = document.dispatchEvent(event);
			var localDispatcher = clickedButton.dispatchEvent(event);

			if (globalDispatcher != false && localDispatcher != false) {
				//Remove preloader
				if (document.querySelector("#overlay")) {
					document.querySelector("#overlay").parentNode.removeChild(document.querySelector("#overlay"));
				}

				//Replace content
				if (responseTargetElement != null) {
					responseTargetElement.innerHTML = html;

					//Run scripts from the loaded html
					var scripts = Array.prototype.slice.call(responseTargetElement.getElementsByTagName("script"));
					for (var i = 0; i < scripts.length; i++) {
						if (scripts[i].src != "") {
							var tag = document.createElement("script");
							tag.src = scripts[i].src;
							document.getElementsByTagName("head")[0].appendChild(tag);
						}
						else {
							eval(scripts[i].innerHTML);
						}
					}
				}
			}
		},

		Error: function (e, responseTargetElement, addPreloaderTimer) {
			clearTimeout(addPreloaderTimer);

			if (document.querySelector("#overlay")) {
				document.querySelector("#overlay").parentNode.removeChild(document.querySelector("#overlay"));
			}
		},

		Debounce: function (func, wait, immediate) {
			return function () {
				controller.abort();
				controller = new AbortController();

				var context = this, args = arguments;
				var later = function () {
					timeout = null;
					if (!immediate) func.apply(context, args);
				};
				var callNow = immediate && !timeout;
				clearTimeout(timeout);
				timeout = setTimeout(later, wait);
				if (callNow) func.apply(context, args);
			};
		},
	}
}();

export { PageUpdater };
