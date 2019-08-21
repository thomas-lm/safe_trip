rm -rf build
echo "build du js avec webpack"
node ./node_modules/webpack/bin/webpack.js
echo "Package dans le zip"
cp -r font build
cp -r img build
cp -r lib build
cp base.css build
cp config.xml build
cp index.html build
cd build
sed -i 's/type="module" //g' index.html
zip -r my-safe-trip.zip *
cd ..
