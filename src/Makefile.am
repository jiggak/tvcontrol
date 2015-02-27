uuid = tv-control@josh.slashdev.ca
jsdir = $(prefix)/$(uuid)
js_DATA = \
	metadata.json

js_SCRIPTS = extension.js lib.js

EXTRA_DIST = $(js_DATA)

uninstall-local:
	-rm -r $(jsdir)
