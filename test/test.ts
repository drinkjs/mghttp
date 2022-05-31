import MgHTTP from "../dist";



const http = new MgHTTP({
  host: "https://stockx.com",
});

const value = "CW2289-111"

http.request(`/api/browse?_search=${value}&page=1&resultsPerPage=10&dataType=product&facetsToRetrieve[]=browseVerticals&propsToRetrieve[][]=brand&propsToRetrieve[][]=colorway&propsToRetrieve[][]=media.thumbUrl&propsToRetrieve[][]=title&propsToRetrieve[][]=productCategory&propsToRetrieve[][]=shortDescription&propsToRetrieve[][]=urlKey`, {
  method:"GET",
  headers:{
    "sec-ch-ua-platform":`"Windows"`,
    "sec-fetch-dest":"document"
  },
  searchParams:{
    "a":'1',
  }
}).then(rel =>{
  console.log(rel);
})