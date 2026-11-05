#!/usr/bin/env python
"""Django's command-line utility (fixture stub: KumiCraft only needs to see a backend here)."""
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
