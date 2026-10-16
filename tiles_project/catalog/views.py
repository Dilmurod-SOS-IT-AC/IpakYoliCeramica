from django.shortcuts import render
from django.contrib.auth.decorators import login_required

from .models import Tile

@login_required
def tile_list(req):
    tiles = Tile.objects.filter(is_active = True).select_related("supplier")
    return render(req, "catalog/tile_list.html", {"tile": tiles})