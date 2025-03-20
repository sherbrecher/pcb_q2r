#!/bin/bash

rm -rf release
mkdir -p release

FILES="edas/kicad/res/logo.png \
       edas/kicad/res/template.kicad_dru \
       edas/kicad/res/template.kicad_pcb \
       edas/kicad/res/template.kicad_prl \
       edas/kicad/res/template.kicad_pro \
       edas/kicad/res/template.kicad_sch \
       edas/kicad/kicad.js \
       lib/jszip.min.js \
       res/icons/icon.png \
       services/jlcpcb/res/favicon \
       services/jlcpcb/res/logo.png \
       services/jlcpcb/jlcpcb.js \
       services/pcbway/res/favicon \
       services/pcbway/res/logo.png \
       services/pcbway/pcbway.js \
       background.js \
       manifest.json \
       popup.html \
       popup.js"

for file in $FILES; do
    if [ -e "$file" ]; then
        if [ -d "$file" ]; then
            mkdir -p "release/$(dirname "$file")"
            cp -r "$file" "release/$(dirname "$file")/"
        else
            mkdir -p "release/$(dirname "$file")"
            cp "$file" "release/$(dirname "$file")/"
        fi
    else
        echo "Warning: $file does not exist"
    fi
done

read -p "Files copied to release folder. Test the extension before signing. Press enter to continue <Enter>"

if [ -z "$AMO_JWT_ISSUER" ]; then
    read -p "Enter AMO_JWT_ISSUER: " AMO_JWT_ISSUER
    export AMO_JWT_ISSUER
fi

if [ -z "$AMO_JWT_SECRET" ]; then
    read -p "Enter AMO_JWT_SECRET: " AMO_JWT_SECRET
    export AMO_JWT_SECRET
fi

cd release

# Sign the extension
web-ext sign --channel=unlisted \
    --api-key="$AMO_JWT_ISSUER" \
    --api-secret="$AMO_JWT_SECRET"

echo "Release process completed"