let ctx = document.getElementById('myChart').getContext('2d');

let path_data = pathsJson;

let pathsLabels = path_data.paths_general.map(x => x.common_name + ' | ' + x.old_speech_name);

var pathsDatasets = [
{
    backgroundColor: [],
    data: [
        1,
        1,
        1
    ],
    ids: [

    ],
    borderColor: 'black',
    borderWidht: 2,
    hoverBorderWidth: 4,
    hoverBorderColor: "#ffcc66"
}, 
{
    backgroundColor: [,,,],

    data: [
        0, 0, 0,
        1, 1, 1,  1, 1, 1, 1, 1, 1
    ],
    ids: [
        '', '', '',
    ],
    borderColor: 'black',
    borderWidht: 2,
    hoverBorderWidth: 4,
    hoverBorderColor: "#ffcc66"
},
            {
                backgroundColor: [, , , , , , , , , , , ,
                ],
                data: [
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                    1, 1, 1, 1, 1, 1, 1, 1, 1,
                    1, 1, 1, 1, 1, 1, 1, 1, 1,
                    1, 1, 1, 1, 1, 1, 1, 1, 1
                ],
                ids: [
                    '', '', '',  '', '', '',,  '', '', '',  '', '', '',
                ],
                borderColor: 'black',
                borderWidht: 2,
                hoverBorderWidth: 4,
                hoverBorderColor: "#ffcc66"
            },

]

var currentIndex = 0
var currentLimit = 0
let limits = [2, 8, 26]

//LOAD COLORS
path_data.paths_appaerance.forEach(element => {
    if(currentIndex > limits[currentLimit]) {
        currentIndex = 0;
        currentLimit++;
    }
        pathsDatasets[currentLimit].backgroundColor.push(element.color)
        pathsDatasets[currentLimit].ids.push(element.path_id)

    currentIndex++;
});
//LOAD COLORS

var myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
        datasets : pathsDatasets.reverse(),
        labels: pathsLabels
    },

    options: {
        responsive: true,
        maintainAspeectRatio: true,

        cutoutPercentage: 5,

        legend: {
            display: false
        },

        tooltips: {
            titleFontSize: 24,
            callbacks: {
                label: function (tooltipItems, data) {  
                    return data.labels[tooltipItems.index];
                }
            }
        },

        onClick: showPathCard
    }

});

function showPathCard(event, array) {
    let datasetIndex = array[0]._datasetIndex;
    let objectIndex = array[0]._index; 

    let pathId = pathsDatasets[datasetIndex].ids[objectIndex];

    console.log(pathId)

    //Building
    let path_general = path_data.paths_general.find(x => x.id === pathId)
    let path_appaerance = path_data.paths_appaerance.find(x => x.path_id === pathId);
    let pathName = path_general.common_name + " | " + path_general.old_speech_name;

    let path_category = path_data.paths_categories.find(x => x.id === path_general.category_id)

    let pathCategoryName = path_category.common_name + " | " + path_category.old_speech_name;

    let path_content = path_data.paths_content.find(x => x.id === pathId)

    let pathContent = path_content.content

    //Display the card
    $("#path_card_container").css("display", "block");

    $("#path_name").text(pathName)
    $("#path_category").text(pathCategoryName)
    $("#path_content").text(pathContent)
    $("#path_image").attr("src", "img/" + pathId + ".png")
}