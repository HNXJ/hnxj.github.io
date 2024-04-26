import plotly.graph_objects as go
import dash
from dash import dcc
from dash import html
from dash.dependencies import Input, Output
import numpy as np


# Create random 3D shapes
def create_random_shape():
    x = np.random.rand(10)
    y = np.random.rand(10)
    z = np.random.rand(10)
    return go.Scatter3d(x=x, y=y, z=z, mode='markers', marker=dict(size=12, color=np.random.randn(10), colorscale='Viridis', opacity=0.8))

# Create Dash app
app = dash.Dash(__name__)

# Define layout
app.layout = html.Div([
    dcc.Graph(id='3d-plot'),
    html.Button('Generate New Shapes', id='generate-button'),
])

# Define callback to update plot
@app.callback(
    Output('3d-plot', 'figure'),
    [Input('generate-button', 'n_clicks')]
)
def update_plot(n_clicks):
    if n_clicks is None:
        return go.Figure()
    else:
        fig = go.Figure(data=[create_random_shape() for _ in range(3)], layout=go.Layout(title='Example'))
        fig.write_html("mind1.html")
        return fig

# Run the app
if __name__ == '__main__':
    app.run_server(debug=True)
